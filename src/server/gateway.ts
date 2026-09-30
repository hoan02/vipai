import "server-only";

import { cookies } from "next/headers";
import { BACKEND_URL, getForwardedFor } from "./http";
import {
  SESSION_COOKIE,
  cookieOptions,
  needsRefresh,
  readSession,
  serialize,
  type Session,
} from "./session";

/**
 * The gateway, as this app uses it.
 *
 * Route names are pinned to what `v1.0.0-rc.40` registers, read out of the
 * running binary rather than assumed:
 *
 *   POST /api/user/login                 POST /api/user/register
 *   POST /api/user/auth/refresh          GET  /api/user/logout
 *   GET  /api/user/self                  GET  /api/user/models
 *   GET  /api/token/                     POST /api/token/
 *   PUT  /api/token/                     DELETE /api/token/:id
 *   POST /api/token/:id/key              GET  /api/log/self
 *
 * Two shapes of error come back. Management routes answer
 * `{message, success:false}` with a 200 or 4xx, and the relay answers
 * `{error:{message}}`. Both are normalised into GatewayError so a caller never
 * has to inspect the body to know a call failed.
 */

/** Quota units per US dollar. new-api denominates quota this way. */
export const QUOTA_PER_USD = 500_000;

export class GatewayError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

export type GatewayUser = {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: number;
  /** Remaining quota, in quota units. */
  quota: number;
  /** Consumed quota, in quota units. */
  usedQuota: number;
  requestCount: number;
  group: string;
  /** Whether the account has a password set, as opposed to OAuth-only. */
  hasPassword: boolean;
  /** Preferred dashboard language, e.g. `vi`. Null when never chosen. */
  language: string | null;
  /** Referral code others can sign up with. */
  affCode: string;
  /** How many people signed up with the referral code. */
  affCount: number;
  /** Unclaimed referral earnings, in quota units. */
  affQuota: number;
  /** Serialized sidebar-module preferences, or null when never set. */
  sidebarModules: string | null;
  /** The account's notification/privacy settings, as stored by the gateway. */
  settings: Record<string, unknown>;
};

export type GatewayToken = {
  id: number;
  key: string;
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  used_quota: number;
  /** Group the key bills under, e.g. `default`. Empty means the account default. */
  group?: string;
  /** Comma-separated model allow-list, when `model_limits_enabled`. */
  model_limits?: string;
  model_limits_enabled?: boolean;
  /** Comma-separated source addresses the key accepts. Empty means any. */
  allow_ips?: string;
  /** Retry on another channel when the group's own is unavailable. */
  cross_group_retry?: boolean;
};

export type GatewayLog = {
  id: number;
  created_at: number;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  quota: number;
  token_name: string;
  /** Request id assigned by the gateway, shown in the detail dialog. */
  request_id?: string;
  /** True when the answer was streamed. */
  is_stream?: boolean;
  /** Seconds the upstream took to answer. */
  use_time?: number;
  /** Source address the request came from. */
  ip?: string;
  /** Group the key was used under, e.g. `default`. */
  group?: string;
  /** Register channel that served it, for diagnostics. */
  channel_name?: string;
  /** 1 consumption, 2 top-up, 3 refund, 4 system, 5 error. */
  type?: number;
};

type Envelope<T> = { data?: T; message?: string; success?: boolean };
type RelayEnvelope = { error?: { message?: string } };

function url(path: string): string {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

/**
 * The user id from a bearer token.
 *
 * Read without verifying: the token came from the gateway over the compose
 * network moments ago, and this value only fills a routing header. Verifying it
 * would mean holding the signing key, which is the gateway's business.
 */
function subjectOf(accessToken: string): string | null {
  const part = accessToken.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Options for one gateway call. `revalidate` is the only field beyond the
 * request shape; it is read by `rawCall`.
 */
type CallInit = RequestInit & {
  token?: string;
  cookie?: string;
  /**
   * Cache this read in Next's data cache for this many seconds.
   *
   * Omit it for anything tied to a signed-in request. A public read sets it,
   * because a `cache: "no-store"` fetch during a prerendered render is exactly
   * what throws "Page changed from static to dynamic at runtime" (see
   * `getOptions`).
   */
  revalidate?: number;
};

/**
 * Performs one gateway call and normalises its result.
 *
 * Always sends the user id alongside the token: the management API resolves
 * permissions from that header, and omitting it makes admin routes behave as if
 * the caller were nobody.
 */
async function rawCall<T>(
  path: string,
  init: CallInit = {},
): Promise<Envelope<T> & RelayEnvelope & { url?: string }> {
  const { token, cookie, revalidate, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body !== undefined) headers.set("content-type", "application/json");

  // Forward the caller's address so the gateway's per-IP rate limiter counts the
  // visitor, not this server. Every call leaves from one container IP otherwise,
  // so unrelated people would share a single bucket and trip it for each other.
  //
  // A revalidated read is shared between visitors, so it carries no one
  // caller's address. It also must not touch `headers()`: that is itself a
  // request-time read, and calling it would opt a prerendered page into dynamic
  // rendering just as a `no-store` fetch would.
  if (revalidate === undefined) {
    const forwardedFor = await getForwardedFor();
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
    const sub = subjectOf(token);
    if (sub) headers.set("new-api-user", sub);
  }
  if (cookie) headers.set("cookie", cookie);

  let response: Response;
  try {
    response = await fetch(url(path), {
      ...rest,
      headers,
      // A public read is cached so the page stays prerendered; everything else
      // is per-request, which is the default this app has always used.
      ...(revalidate === undefined
        ? { cache: "no-store" as const }
        : { cache: "force-cache" as const, next: { revalidate } }),
    });
  } catch (cause) {
    throw new GatewayError(
      `Could not reach the gateway: ${(cause as Error).message}`,
      503,
    );
  }

  const text = await response.text();
  let body: Envelope<T> & RelayEnvelope & { url?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GatewayError(
      `The gateway returned a non-JSON response (HTTP ${response.status}).`,
      502,
    );
  }

  if (!response.ok) {
    // 429 is the gateway rate limiting, which the caller should surface as such
    // rather than as a generic failure.
    if (response.status === 429) {
      const retry = response.headers.get("retry-after");
      const seconds = retry ? Number(retry) : NaN;
      throw new GatewayError(
        Number.isFinite(seconds) && seconds > 0
          ? `Too many requests. Try again in about ${Math.ceil(seconds / 60)} minute(s).`
          : "Too many requests. Try again shortly.",
        429,
      );
    }
    throw new GatewayError(
      body.message || body.error?.message || `Gateway error (HTTP ${response.status})`,
      response.status,
    );
  }

  // A 200 that carries success:false is still a failure.
  if (body.success === false) {
    throw new GatewayError(body.message || "The gateway rejected the request.", 400);
  }

  return body;
}

async function call<T>(
  path: string,
  init: CallInit = {},
): Promise<T> {
  const body = await rawCall<T>(path, init);
  return (body.data ?? (body as unknown)) as T;
}

/** Reads the refresh cookie the gateway set on a login or refresh response. */
function refreshTokenFrom(response: Response): string | null {
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const match = /^new_api_refresh=([^;]+)/.exec(cookie);
    if (match) return match[1];
  }
  return null;
}

function sessionFrom(response: Response, data: LoginData, fallback?: Session): Session {
  const refreshToken = refreshTokenFrom(response) ?? fallback?.refreshToken;
  if (!refreshToken) {
    throw new GatewayError("The gateway did not return a refresh token.", 502);
  }
  return {
    accessToken: data.access_token,
    refreshToken,
    // access_expires_at is epoch seconds.
    expiresAt: data.access_expires_at * 1000,
  };
}

type LoginData = { access_token: string; access_expires_at: number };

/** Signs in. Throws GatewayError with status 401 on bad credentials. */
export async function login(username: string, password: string): Promise<Session> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  // Sign-in and registration are rate limited per IP, and this call is the one
  // that trips first. Forward the caller's address so one NAT or office does not
  // exhaust the allowance for everyone behind it.
  const forwardedFor = await getForwardedFor();
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;

  const response = await fetch(url("/api/user/login"), {
    method: "POST",
    headers,
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  const text = await response.text();
  let body: Envelope<LoginData> & RelayEnvelope = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GatewayError("The gateway returned a non-JSON login response.", 502);
  }

  if (!response.ok || body.success === false || !body.data?.access_token) {
    // The status must be preserved. new-api answers 429 when it is rate limiting
    // sign-ins, and reporting that as 401 tells the user their password is wrong
    // when it is not â€” which is exactly what this did before.
    const status = response.status === 200 ? 401 : response.status;
    throw new GatewayError(
      body.message || body.error?.message || "Incorrect username or password.",
      status,
    );
  }

  return sessionFrom(response, body.data);
}

/**
 * Exchanges a refresh token for a new access token.
 *
 * The gateway authenticates this one call by cookie, not by bearer token, which
 * is why the refresh value is kept as a header rather than a JSON field. Returns
 * null when the refresh token is no longer good, which is how a 30-day-old
 * session ends.
 */
export async function renew(session: Session): Promise<Session | null> {
  const headers: Record<string, string> = {
    accept: "application/json",
    cookie: `new_api_refresh=${session.refreshToken}`,
  };
  const forwardedFor = await getForwardedFor();
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;

  let response: Response;
  try {
    response = await fetch(url("/api/user/auth/refresh"), {
      method: "POST",
      headers,
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const text = await response.text();
  let body: Envelope<LoginData>;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body.data?.access_token || !body.data.access_expires_at) return null;

  return sessionFrom(response, body.data, session);
}

/** Ends the session at the gateway. Best effort: the local cookie is what matters. */
export async function logout(session: Session): Promise<void> {
  try {
    await call("/api/user/logout", { token: session.accessToken });
  } catch {
    // A refresh-token-only logout path does not exist in this release, so a
    // expired access token means the call cannot succeed. The local cookie is
    // dropped either way.
  }
}

/** Creates an account. The gateway requires the password twice. */
export async function register(username: string, password: string, email: string): Promise<void> {
  await call("/api/user/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      password2: password,
      email: email || undefined,
    }),
  });
}

/**
 * Begins a custom-provider sign-in, returning the provider's authorize URL.
 *
 * Asks the gateway for a one-time state token and builds the URL with
 * `redirectUri` — the public callback this app serves. It has to be that exact
 * value: the gateway recomputes it from its own Server Address when it later
 * exchanges the code, and Google rejects a mismatch.
 */
export async function startOAuth(provider: string, redirectUri: string): Promise<string> {
  const status = await getStatus();
  const config = status.customOauthProviders.find((item) => item.slug === provider);
  if (!config) {
    throw new GatewayError(`Sign-in with ${provider} is not configured.`, 404);
  }
  if (!config.clientId || !config.authorizationEndpoint) {
    throw new GatewayError(`Sign-in with ${provider} is not fully configured.`, 502);
  }

  const data = await call<{ flow_token?: string }>("/api/oauth/state", {
    method: "POST",
    body: JSON.stringify({ provider, intent: "login" }),
  });
  const state = data?.flow_token;
  if (!state) {
    throw new GatewayError("The gateway did not return an OAuth state.", 502);
  }

  const authorize = new URL(config.authorizationEndpoint);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
  if (config.scopes) authorize.searchParams.set("scope", config.scopes);
  return authorize.toString();
}

/**
 * Completes a custom-provider callback and returns the session to persist.
 *
 * The gateway answers with the same login payload as `/api/user/login` plus a
 * refresh cookie, so this mirrors `login`. It runs server-side: the browser
 * never holds a gateway token, and the gateway's CORS would block the exchange
 * from the site origin anyway.
 */
export async function completeOAuth(
  provider: string,
  code: string,
  state: string,
): Promise<Session> {
  const headers: Record<string, string> = { accept: "application/json" };
  const forwardedFor = await getForwardedFor();
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;

  const params = new URLSearchParams({ code, state });
  const response = await fetch(
    url(`/api/oauth/${encodeURIComponent(provider)}?${params.toString()}`),
    { method: "GET", headers, cache: "no-store" },
  );

  const text = await response.text();
  let body: Envelope<LoginData> & RelayEnvelope = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GatewayError("The gateway returned a non-JSON OAuth response.", 502);
  }

  if (!response.ok || body.success === false || !body.data?.access_token) {
    throw new GatewayError(
      body.message || body.error?.message || "OAuth sign-in failed.",
      response.status === 200 ? 400 : response.status,
    );
  }

  return sessionFrom(response, body.data);
}

/** The signed-in account. */
export async function getUser(accessToken: string): Promise<GatewayUser> {
  const data = await call<{
    id: number;
    username: string;
    display_name: string;
    email: string;
    role: number;
    quota: number;
    used_quota: number;
    request_count: number;
    group: string;
    has_password?: boolean;
    setting?: unknown;
    aff_code?: string;
    aff_count?: number;
    aff_quota?: number;
  }>("/api/user/self", { token: accessToken });

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name || data.username,
    email: data.email || null,
    role: data.role,
    quota: data.quota ?? 0,
    usedQuota: data.used_quota ?? 0,
    requestCount: data.request_count ?? 0,
    group: data.group || "default",
    hasPassword: Boolean(data.has_password),
    language: languageOf(data.setting),
    affCode: data.aff_code ?? "",
    affCount: data.aff_count ?? 0,
    affQuota: data.aff_quota ?? 0,
    sidebarModules: sidebarModulesOf(data.setting),
    settings: parseSetting(data.setting),
  };
}

/**
 * Parses the user's `setting` blob.
 *
 * It is a JSON string on the user row, not an object, and a malformed value is
 * treated as empty rather than fatal.
 */
export function parseSetting(setting: unknown): Record<string, unknown> {
  if (typeof setting !== "string" || setting.trim() === "") return {};
  try {
    const parsed = JSON.parse(setting) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Reads the serialized sidebar-module preferences out of the settings blob. */
function sidebarModulesOf(setting: unknown): string | null {
  const value = parseSetting(setting).sidebar_modules;
  return typeof value === "string" && value.trim() ? value : null;
}

/** The account's API keys, newest first. */
export async function listTokens(accessToken: string): Promise<GatewayToken[]> {
  const data = await call<{ items: GatewayToken[] }>(
    "/api/token/?p=0&size=100",
    { token: accessToken },
  );
  return (data.items ?? []).sort((a, b) => b.created_time - a.created_time);
}

/**
 * The billing groups this account may use.
 *
 * Returned as a name plus its human description. The gateway keys the map by
 * group id, so the id is carried through as `name` for the create form.
 */
export async function listGroups(
  accessToken: string,
): Promise<Array<{ name: string; description: string; ratio: number }>> {
  const data = await call<Record<string, { desc?: string; ratio?: number }>>(
    "/api/user/self/groups",
    { token: accessToken },
  );

  return Object.entries(data ?? {}).map(([name, value]) => ({
    name,
    description: value?.desc || name,
    ratio: value?.ratio ?? 1,
  }));
}

/**
 * Every model this account is allowed to call, deduplicated and sorted.
 *
 * The endpoint already filters by the account's group, so this is the same list
 * the playground and the key form should offer.
 */
export async function getUserModels(accessToken: string): Promise<string[]> {
  const data = await call<string[]>("/api/user/models", { token: accessToken });
  return [...new Set(data ?? [])].sort((a, b) => a.localeCompare(b));
}

/**
 * Creates a key and returns it, with the secret.
 *
 * This takes three calls because the gateway reveals nothing at creation:
 * `POST /api/token/` answers only `{success:true}` with no id, the list returns
 * `sk-xxxx********yyyy`, and only `POST /api/token/:id/key` yields the real
 * value. A client-supplied key is ignored, so it cannot be chosen up front.
 *
 * `unlimited_quota: true` matters: the create default is a quota of zero, which
 * produces a key that authenticates and then refuses every request.
 */
export async function createToken(
  accessToken: string,
  name: string,
  options: {
    /** Model allow-list. Empty or omitted means every model the account may use. */
    models?: string[];
    /** Group to bill under. Empty means the account default. */
    group?: string;
    /** Source addresses the key accepts, comma separated. Empty means any. */
    allowIps?: string;
    /** Unix seconds, or -1 for never. */
    expiredTime?: number;
    /** Quota in units, when not unlimited. */
    remainQuota?: number;
    /** Retry other groups when this one is down. */
    crossGroupRetry?: boolean;
  } = {},
): Promise<{ token: GatewayToken; key: string }> {
  const before = await listTokens(accessToken);
  const known = new Set(before.map((token) => token.id));

  const models = (options.models ?? []).map((m) => m.trim()).filter(Boolean);

  await call("/api/token/", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({
      name,
      remain_quota: options.remainQuota ?? 0,
      unlimited_quota: options.remainQuota === undefined,
      expired_time: options.expiredTime ?? -1,
      group: options.group ?? "",
      model_limits_enabled: models.length > 0,
      model_limits: models.join(","),
      allow_ips: options.allowIps ?? "",
      cross_group_retry: options.crossGroupRetry ?? false,
    }),
  });

  const after = await listTokens(accessToken);
  const created = after.find((token) => !known.has(token.id));
  if (!created) {
    throw new GatewayError(
      "The key was created but could not be identified afterwards.",
      502,
    );
  }

  const revealed = await call<{ key: string }>(`/api/token/${created.id}/key`, {
    method: "POST",
    token: accessToken,
  });

  return { token: created, key: revealed.key };
}

/**
 * Enabling and disabling a key is not possible through this release's API.
 *
 * Verified against rc.40 rather than assumed:
 *
 *   PUT  /api/token/ with status:2   status comes back 1; the field is not writable
 *   POST /api/token/batch status:2   deletes the token (the record is gone afterwards)
 *   PUT  with a past expired_time    accepted, but the relay still serves the key
 *
 * So the only state change the API offers is deletion. This throws rather than
 * quietly doing something else, and `revokeApiKey` is the operation the UI
 * exposes.
 */
export async function setTokenEnabled(
  _accessToken: string,
  _id: string,
  _enabled: boolean,
): Promise<never> {
  throw new GatewayError(
    "The gateway does not support disabling a key. Revoke it instead.",
    501,
  );
}

/** Deletes a key permanently. */
export async function deleteToken(accessToken: string, id: string): Promise<void> {
  await call(`/api/token/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token: accessToken,
  });
}

/** Recent usage rows, newest first. */
export async function listLogs(
  accessToken: string,
  pageSize = 100,
): Promise<GatewayLog[]> {
  const data = await call<{ items: GatewayLog[] }>(
    `/api/log/self?p=0&page_size=${pageSize}`,
    { token: accessToken },
  );
  return data.items ?? [];
}

/**
 * A page of usage rows with the gateway's own totals.
 *
 * The richer sibling of `listLogs`: it keeps the pagination metadata and the
 * fields the usage screen filters and renders (request id, stream flag, latency,
 * source ip, group), which the dashboard summary does not need.
 */
export type PagedResult<T> = {
  items: T[];
  /** Zero-based page index, so the client can page with `page + 1`. */
  page: number;
  pageSize: number;
  total: number;
};

/** Filters shared by the paged log endpoints. */
export type LogQuery = {
  page?: number;
  pageSize?: number;
  startTimestamp?: number;
  endTimestamp?: number;
  modelName?: string;
  tokenName?: string;
  group?: string;
  username?: string;
  requestId?: string;
};

function pagedParams(query: LogQuery): URLSearchParams {
  const page = Math.max(0, query.page ?? 0);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  // The gateway pages from 1; this app pages from 0, so the translation
  // happens here and nowhere else.
  const params = new URLSearchParams({ p: String(page + 1), page_size: String(pageSize) });
  if (query.startTimestamp) params.set("start_timestamp", String(Math.floor(query.startTimestamp)));
  if (query.endTimestamp) params.set("end_timestamp", String(Math.floor(query.endTimestamp)));
  if (query.modelName) params.set("model_name", query.modelName);
  if (query.tokenName) params.set("token_name", query.tokenName);
  if (query.group) params.set("group", query.group);
  if (query.username) params.set("username", query.username);
  if (query.requestId) params.set("request_id", query.requestId);
  return params;
}

function normalizePage<T>(
  data: { items?: T[]; page?: number; page_size?: number; total?: number },
  query: LogQuery,
): PagedResult<T> {
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  return {
    items: data.items ?? [],
    page: Math.max(0, query.page ?? 0),
    pageSize: data.page_size ?? pageSize,
    total: data.total ?? 0,
  };
}

export function listLogsPaged(
  accessToken: string,
  query: LogQuery = {},
): Promise<PagedResult<GatewayLog>> {
  return call<{ items?: GatewayLog[]; page?: number; page_size?: number; total?: number }>(
    `/api/log/self?${pagedParams(query).toString()}`,
    { token: accessToken },
  ).then((data) => normalizePage(data, query));
}

/** One audit-log row: an authenticated action the account or its keys took. */
export type GatewayAuditLog = {
  id: number;
  event_id: string;
  created_at: number;
  category: string;
  action: string;
  token_ref: string;
  auth_method: string;
  ip: string;
  user_agent: string;
  method: string;
  route: string;
  status: number;
  success: boolean;
  request_id: string;
  content: string;
};

export function listAuditLogsPaged(
  accessToken: string,
  query: LogQuery = {},
): Promise<PagedResult<GatewayAuditLog>> {
  return call<{ items?: GatewayAuditLog[]; page?: number; page_size?: number; total?: number }>(
    `/api/audit/self?${pagedParams(query).toString()}`,
    { token: accessToken },
  ).then((data) => normalizePage(data, query));
}

/** One asynchronous task the account submitted (video, music, image, etc.). */
export type GatewayTask = {
  id: number;
  created_at: number;
  task_id: string;
  platform: string;
  group: string;
  quota: number;
  action: string;
  status: string;
  fail_reason: string;
  submit_time: number;
  start_time: number;
  finish_time: number;
  progress: string;
};

export function listTaskLogsPaged(
  accessToken: string,
  query: LogQuery = {},
): Promise<PagedResult<GatewayTask>> {
  return call<{ items?: GatewayTask[]; page?: number; page_size?: number; total?: number }>(
    `/api/task/self?${pagedParams(query).toString()}`,
    { token: accessToken },
  ).then((data) => normalizePage(data, query));
}

/** One Midjourney-style drawing task. */
export type GatewayDrawingLog = {
  id: number;
  action: string;
  mj_id: string;
  prompt: string;
  prompt_en: string;
  description: string;
  state: string;
  submit_time: number;
  start_time: number;
  finish_time: number;
  image_url: string;
  status: string;
  progress: string;
  fail_reason: string;
  quota: number;
};

export function listDrawingLogsPaged(
  accessToken: string,
  query: LogQuery = {},
): Promise<PagedResult<GatewayDrawingLog>> {
  return call<{ items?: GatewayDrawingLog[]; page?: number; page_size?: number; total?: number }>(
    `/api/mj/self?${pagedParams(query).toString()}`,
    { token: accessToken },
  ).then((data) => normalizePage(data, query));
}

/** The account's own usage rollup: quota spent, requests per minute, tokens per minute. */
export type SelfLogStat = { quota: number; rpm: number; tpm: number };

export async function getLogStat(accessToken: string): Promise<SelfLogStat> {
  const data = await call<SelfLogStat>("/api/log/self/stat", { token: accessToken });
  return { quota: data.quota ?? 0, rpm: data.rpm ?? 0, tpm: data.tpm ?? 0 };
}

/**
 * One bucket of the gateway's quota data, already summed by time unit.
 *
 * `created_at` is the bucket's start, in unix seconds; the other three fields
 * are that bucket's totals for one model.
 */
export type GatewayQuotaDatum = {
  id?: number;
  user_id?: number;
  username?: string;
  model_name?: string;
  created_at: number;
  token_used?: number;
  count?: number;
  quota?: number;
};

/**
 * The account's quota usage grouped by time and model.
 *
 * `default_time` is the bucket width the gateway groups by (`hour`, `day`,
 * `week`). The admin path spans every account, so the caller decides the role
 * first and this never guesses.
 */
export async function getQuotaData(
  accessToken: string,
  options: {
    startTimestamp: number;
    endTimestamp: number;
    granularity: string;
    username?: string;
  },
  isAdmin = false,
): Promise<GatewayQuotaDatum[]> {
  const params = new URLSearchParams({
    start_timestamp: String(Math.floor(options.startTimestamp)),
    end_timestamp: String(Math.floor(options.endTimestamp)),
    default_time: options.granularity,
  });
  if (options.username) params.set("username", options.username);

  const path = isAdmin ? "/api/data/" : "/api/data/self";
  const data = await call<GatewayQuotaDatum[]>(`${path}?${params.toString()}`, {
    token: accessToken,
  });
  return Array.isArray(data) ? data : [];
}

/* --- console status, performance and uptime ------------------------------ */

/** One configured relay route from the console's API-info panel. */
export type GatewayApiInfo = {
  url: string;
  route: string;
  description: string;
  color: string;
};

/** One console announcement. `type` drives the colour of its dot. */
export type GatewayAnnouncement = {
  id?: number;
  content: string;
  publishDate?: string;
  type?: string;
  extra?: string;
};

/** One console FAQ entry. */
export type GatewayFaq = { id?: number; question: string; answer: string };

/**
 * The console's public status payload.
 *
 * Served anonymously (`GET /api/status`), and the only source for the optional
 * Overview panels: the API route list, the announcement feed and the FAQ. Each
 * block is present only when the gateway has it enabled, so the `*_enabled`
 * flags are read alongside it rather than inferred from an empty list.
 */
/** A custom OAuth provider the gateway exposes for sign-in, e.g. Google. */
export type GatewayOAuthProvider = {
  name: string;
  slug: string;
  clientId: string;
  /** The provider's authorize endpoint, ready to take query parameters. */
  authorizationEndpoint: string;
  /** Space-separated scopes, as the gateway stores them. */
  scopes: string;
};

export type GatewayStatus = {
  version: string;
  systemName: string;
  /** Custom OAuth providers offered on the sign-in dialog. */
  customOauthProviders: GatewayOAuthProvider[];
  /** When true the console shows quota as money; quota is always the unit here. */
  displayInCurrency: boolean;
  quotaPerUnit: number;
  apiInfoEnabled: boolean;
  announcementsEnabled: boolean;
  faqEnabled: boolean;
  uptimeKumaEnabled: boolean;
  apiInfo: GatewayApiInfo[];
  announcements: GatewayAnnouncement[];
  faq: GatewayFaq[];
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function getStatus(): Promise<GatewayStatus> {
  const data = await call<Record<string, unknown>>("/api/status");
  return {
    version: asString(data.version),
    systemName: asString(data.system_name, "VipAI"),
    customOauthProviders: asArray<Record<string, unknown>>(
      data.custom_oauth_providers,
    ).map((provider) => ({
      name: asString(provider.name),
      slug: asString(provider.slug),
      clientId: asString(provider.client_id),
      authorizationEndpoint: asString(provider.authorization_endpoint),
      scopes: asString(provider.scopes),
    })),
    displayInCurrency: Boolean(data.display_in_currency),
    quotaPerUnit: Number(data.quota_per_unit) || QUOTA_PER_USD,
    apiInfoEnabled: data.api_info_enabled !== false,
    announcementsEnabled: data.announcements_enabled !== false,
    faqEnabled: data.faq_enabled !== false,
    uptimeKumaEnabled: Boolean(data.uptime_kuma_enabled),
    apiInfo: asArray<Record<string, unknown>>(data.api_info).map((item) => ({
      url: asString(item.url),
      route: asString(item.route),
      description: asString(item.description),
      color: asString(item.color, "blue"),
    })),
    announcements: asArray<Record<string, unknown>>(data.announcements).map((item) => ({
      id: typeof item.id === "number" ? item.id : undefined,
      content: asString(item.content),
      publishDate: asString(item.publishDate) || undefined,
      type: asString(item.type) || undefined,
      extra: asString(item.extra) || undefined,
    })),
    faq: asArray<Record<string, unknown>>(data.faq).map((item) => ({
      id: typeof item.id === "number" ? item.id : undefined,
      question: asString(item.question),
      answer: asString(item.answer),
    })),
  };
}

/** One hour-bucketed usage row, as `/api/data/self` reports it. */
export type GatewayQuotaPoint = {
  /** Unix seconds, truncated to the hour by the gateway. */
  createdAt: number;
  quota: number;
  count: number;
  tokens: number;
  model: string;
};

/**
 * The account's own usage, bucketed by hour.
 *
 * The dashboard's Data-export feature has to be on for the gateway to write
 * these rows; when it is off the endpoint answers an empty list and the caller
 * falls back to the raw log. A thin adapter over `getQuotaData`, so the Overview
 * and the model-analytics page read the same wire shape.
 */
export async function getQuotaDataSelf(
  accessToken: string,
  range: { start: number; end: number },
): Promise<GatewayQuotaPoint[]> {
  const rows = await getQuotaData(accessToken, {
    startTimestamp: range.start,
    endTimestamp: range.end,
    granularity: "hour",
  });
  return rows.map((row) => ({
    createdAt: Number(row.created_at) || 0,
    quota: Number(row.quota) || 0,
    count: Number(row.count) || 0,
    tokens: Number(row.token_used) || 0,
    model: row.model_name || "unknown",
  }));
}

/** Per-model performance over the metrics window. */
export type GatewayPerfModel = {
  modelName: string;
  successRate: number;
  avgLatencyMs: number;
  avgTps: number;
};

/** Request-weighted performance totals plus the per-model breakdown. */
export type GatewayPerfSummary = {
  successRate: number | null;
  avgLatencyMs: number | null;
  avgTps: number | null;
  models: GatewayPerfModel[];
};

export async function getPerfSummary(
  accessToken: string | undefined,
  hours = 24,
): Promise<GatewayPerfSummary> {
  const data = await call<{
    summary?: { avg_latency_ms?: number; success_rate?: number; avg_tps?: number } | null;
    models?: Array<Record<string, unknown>>;
  }>(`/api/perf-metrics/summary?hours=${hours}`, { token: accessToken });

  const summary = data.summary ?? null;
  return {
    successRate: summary ? Number(summary.success_rate) : null,
    avgLatencyMs: summary ? Number(summary.avg_latency_ms) : null,
    avgTps: summary ? Number(summary.avg_tps) : null,
    models: (data.models ?? []).map((row) => ({
      modelName: asString(row.model_name, "unknown"),
      successRate: Number(row.success_rate) || 0,
      avgLatencyMs: Number(row.avg_latency_ms) || 0,
      avgTps: Number(row.avg_tps) || 0,
    })),
  };
}

export type GatewayUptimeMonitor = {
  name: string;
  /** 0–1 fraction, as the gateway reports it. */
  uptime: number;
  /** 1 up, 0 down, 2 pending, 3 maintenance. */
  status: number;
  group?: string;
};

export type GatewayUptimeGroup = { categoryName: string; monitors: GatewayUptimeMonitor[] };

export async function getUptimeStatus(): Promise<GatewayUptimeGroup[]> {
  const data = await call<Array<Record<string, unknown>>>("/api/uptime/status");
  return asArray<Record<string, unknown>>(data).map((group) => ({
    categoryName: asString(group.categoryName, "Services"),
    monitors: asArray<Record<string, unknown>>(group.monitors).map((monitor) => ({
      name: asString(monitor.name),
      uptime: Number(monitor.uptime) || 0,
      status: Number(monitor.status) || 0,
      group: asString(monitor.group) || undefined,
    })),
  }));
}

/**
 * Reveals a key's plaintext value.
 *
 * The list only ever returns a mask. This route is the single place the gateway
 * parts with the real value, which is why the reveal is a deliberate call.
 */
export async function revealTokenKey(accessToken: string, id: string): Promise<string> {
  const data = await call<{ key: string }>(`/api/token/${encodeURIComponent(id)}/key`, {
    method: "POST",
    token: accessToken,
  });
  return typeof data.key === "string" ? data.key : "";
}

/* --- wallet -------------------------------------------------------------- */

/** One credit purchase the account made. */
export type GatewayTopUp = {
  id: number;
  user_id: number;
  amount: number;
  money: number;
  trade_no: string;
  create_time: number;
  complete_time: number;
  status: string;
  payment_method: string;
};

/** The account's purchase history, newest first. */
export async function listTopUps(
  accessToken: string,
  pageSize = 50,
): Promise<GatewayTopUp[]> {
  const data = await call<{ items: GatewayTopUp[] }>(
    `/api/user/topup/self?p=0&page_size=${pageSize}`,
    { token: accessToken },
  );
  return data.items ?? [];
}

/** What the gateway will accept for a purchase: amounts, methods, toggles. */
export type TopUpInfo = {
  minTopup: number;
  amountOptions: number[];
  enableRedemption: boolean;
  enableOnlineTopup: boolean;
  payMethods: Array<{ name: string; type: string; icon: string }>;
};

export async function getTopUpInfo(accessToken: string): Promise<TopUpInfo> {
  const data = await call<{
    amount_options?: number[];
    min_topup?: number;
    enable_redemption?: boolean;
    enable_online_topup?: boolean;
    pay_methods?: Array<{ name: string; type: string; icon: string }>;
  }>("/api/user/topup/info", { token: accessToken });

  return {
    minTopup: data.min_topup ?? 1,
    amountOptions: data.amount_options ?? [10, 20, 50, 100, 200, 500],
    enableRedemption: data.enable_redemption ?? false,
    enableOnlineTopup: data.enable_online_topup ?? false,
    payMethods: data.pay_methods ?? [],
  };
}

/**
 * Redeems a credit code.
 *
 * Returns the credited amount in quota units. The gateway answers a generic
 * failure for every bad code, deliberately, so the caller cannot tell an
 * already-used code from a nonexistent one.
 */
export async function redeemCode(accessToken: string, key: string): Promise<number> {
  const data = await call<number>("/api/user/topup", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ key }),
  });
  return typeof data === "number" ? data : 0;
}

/**
 * Starts an online purchase.
 *
 * The epay handler answers `{message, data, url}` where a success carries the
 * payment URL and its form parameters, and a failure carries a reason in `data`.
 * The shared `call` helper would return the reason and drop the rest, so this
 * reads the body whole. The caller must POST `params` to `url` (not just open
 * it) — that is how these gateways expect the order to arrive.
 */
export async function requestEpayTopUp(
  accessToken: string,
  amount: number,
  paymentMethod: string,
): Promise<{ url: string; params: Record<string, unknown> }> {
  const body = await rawCall<Record<string, unknown>>("/api/user/pay", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ amount, payment_method: paymentMethod }),
  });
  if (typeof body.url === "string" && body.url) {
    const params =
      body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
    return { url: body.url, params };
  }
  const detail = typeof body.data === "string" ? body.data : body.message;
  throw new GatewayError(detail || "Could not start the payment.", 400);
}

/* --- subscriptions ------------------------------------------------------- */

/** A purchasable subscription plan, in the view's shape. */
export type SubscriptionPlan = {
  id: number;
  title: string;
  subtitle: string;
  priceAmount: number;
  currency: string;
  /** `month`, `day`, `year`, `hour` or `custom`. */
  durationUnit: string;
  durationValue: number;
  customSeconds: number;
  /** Whether the wallet balance may be used instead of an online payment. */
  allowBalancePay: boolean;
  /** Included quota, in quota units. Zero means unlimited. */
  totalAmount: number;
  quotaResetPeriod: string;
  upgradeGroup: string;
  maxPurchasePerUser: number;
};

export type UserSubscription = {
  id: number;
  planId: number;
  amountTotal: number;
  amountUsed: number;
  startTime: number;
  endTime: number;
  status: string;
  upgradeGroup: string;
};

type RawPlan = {
  id: number;
  title: string;
  subtitle?: string;
  price_amount?: number;
  currency?: string;
  duration_unit?: string;
  duration_value?: number;
  custom_seconds?: number;
  allow_balance_pay?: boolean | null;
  total_amount?: number;
  quota_reset_period?: string;
  upgrade_group?: string;
  max_purchase_per_user?: number;
};

function toPlan(raw: RawPlan): SubscriptionPlan {
  return {
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle ?? "",
    priceAmount: raw.price_amount ?? 0,
    currency: raw.currency ?? "USD",
    durationUnit: raw.duration_unit ?? "month",
    durationValue: raw.duration_value ?? 1,
    customSeconds: raw.custom_seconds ?? 0,
    allowBalancePay: raw.allow_balance_pay !== false,
    totalAmount: raw.total_amount ?? 0,
    quotaResetPeriod: raw.quota_reset_period ?? "never",
    upgradeGroup: raw.upgrade_group ?? "",
    maxPurchasePerUser: raw.max_purchase_per_user ?? 0,
  };
}

function toSubscription(raw: {
  id: number;
  plan_id: number;
  amount_total: number;
  amount_used: number;
  start_time: number;
  end_time: number;
  status: string;
  upgrade_group?: string;
}): UserSubscription {
  return {
    id: raw.id,
    planId: raw.plan_id,
    amountTotal: raw.amount_total,
    amountUsed: raw.amount_used,
    startTime: raw.start_time,
    endTime: raw.end_time,
    status: raw.status,
    upgradeGroup: raw.upgrade_group ?? "",
  };
}

/** The plans the operator has enabled. Empty when payments are unconfigured. */
export async function getSubscriptionPlans(
  accessToken: string,
): Promise<SubscriptionPlan[]> {
  const data = await call<Array<{ plan: RawPlan }>>("/api/subscription/plans", {
    token: accessToken,
  });
  return (data ?? []).map((row) => toPlan(row.plan));
}

export type SubscriptionSelf = {
  billingPreference: string;
  active: UserSubscription[];
  all: UserSubscription[];
};

/** The account's active and historical subscriptions. */
export async function getSubscriptionSelf(
  accessToken: string,
): Promise<SubscriptionSelf> {
  const data = await call<{
    billing_preference?: string;
    subscriptions?: Parameters<typeof toSubscription>[0][];
    all_subscriptions?: Array<{ subscription?: Parameters<typeof toSubscription>[0] }>;
  }>("/api/subscription/self", { token: accessToken });

  return {
    billingPreference: data.billing_preference ?? "balance",
    active: (data.subscriptions ?? []).map(toSubscription),
    all: (data.all_subscriptions ?? [])
      .map((row) => row.subscription)
      .filter((row): row is Parameters<typeof toSubscription>[0] => Boolean(row))
      .map(toSubscription),
  };
}

/** Buys a plan with the wallet balance. */
export async function purchaseSubscriptionWithBalance(
  accessToken: string,
  planId: number,
): Promise<void> {
  await call("/api/subscription/balance/pay", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ plan_id: planId }),
  });
}

/**
 * Moves affiliate earnings into the wallet balance.
 *
 * `quota` is in quota units; the account's own earnings are the only source, so
 * the gateway rejects a request larger than the balance.
 */
export async function transferAffiliateQuota(
  accessToken: string,
  quota: number,
): Promise<void> {
  await call("/api/user/aff_transfer", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ quota }),
  });
}

/* --- check-in ------------------------------------------------------------ */

export type CheckinRecord = { date: string; quotaAwarded: number };

export type CheckinStatus = {
  enabled: boolean;
  minQuota: number;
  maxQuota: number;
  totalQuota: number;
  totalCheckins: number;
  monthCount: number;
  checkedInToday: boolean;
  records: CheckinRecord[];
};

/** The account's check-in calendar and totals for a month (`YYYY-MM`). */
export async function getCheckinStatus(
  accessToken: string,
  month?: string,
): Promise<CheckinStatus> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const data = await call<{
    enabled?: boolean;
    min_quota?: number;
    max_quota?: number;
    stats?: {
      total_quota?: number;
      total_checkins?: number;
      checkin_count?: number;
      checked_in_today?: boolean;
      records?: Array<{ checkin_date: string; quota_awarded: number }>;
    };
  }>(`/api/user/checkin${query}`, { token: accessToken });

  const stats = data.stats ?? {};
  return {
    enabled: data.enabled ?? true,
    minQuota: data.min_quota ?? 0,
    maxQuota: data.max_quota ?? 0,
    totalQuota: stats.total_quota ?? 0,
    totalCheckins: stats.total_checkins ?? 0,
    monthCount: stats.checkin_count ?? 0,
    checkedInToday: stats.checked_in_today ?? false,
    records: (stats.records ?? []).map((row) => ({
      date: row.checkin_date,
      quotaAwarded: row.quota_awarded,
    })),
  };
}

/** Claims today's check-in reward. Returns the quota awarded. */
export async function doCheckin(accessToken: string): Promise<number> {
  const data = await call<{ quota_awarded?: number }>("/api/user/checkin", {
    method: "POST",
    token: accessToken,
  });
  return data.quota_awarded ?? 0;
}

/* --- sessions ------------------------------------------------------------ */

/** One signed-in browser session. */
export type GatewaySession = {
  sid: string;
  current: boolean;
  loginMethod: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
};

export async function listSessions(accessToken: string): Promise<GatewaySession[]> {
  const data = await call<
    Array<{
      sid: string;
      current: boolean;
      login_method: string;
      ip: string;
      user_agent: string;
      created_at: number;
      last_active_at: number;
      expires_at: number;
    }>
  >("/api/user/sessions", { token: accessToken });

  return (data ?? []).map((row) => ({
    sid: row.sid,
    current: row.current,
    loginMethod: row.login_method || "password",
    ip: row.ip || "",
    userAgent: row.user_agent || "",
    createdAt: new Date(row.created_at * 1000),
    lastActiveAt: new Date(row.last_active_at * 1000),
    expiresAt: new Date(row.expires_at * 1000),
  }));
}

/** Revokes one session by id. */
export async function revokeSession(accessToken: string, sid: string): Promise<void> {
  await call(`/api/user/sessions/${encodeURIComponent(sid)}`, {
    method: "DELETE",
    token: accessToken,
  });
}

/** Revokes every session except the one making the call. */
export async function revokeOtherSessions(accessToken: string): Promise<void> {
  await call("/api/user/sessions/revoke-others", {
    method: "POST",
    token: accessToken,
  });
}

/* --- profile ------------------------------------------------------------- */

/** Updates the editable parts of the account. */
export async function updateSelf(
  accessToken: string,
  patch: { displayName?: string; username?: string; language?: string },
): Promise<void> {
  const body: Record<string, string> = {};
  if (patch.displayName !== undefined) body.display_name = patch.displayName;
  if (patch.username !== undefined) body.username = patch.username;
  // `language` is handled by its own branch in the controller and needs no other
  // field, so it is sent on its own.
  if (patch.language !== undefined) body.language = patch.language;
  if (Object.keys(body).length === 0) return;

  await call("/api/user/self", {
    method: "PUT",
    token: accessToken,
    body: JSON.stringify(body),
  });
}

/**
 * Reads the account language preference out of the user's settings blob.
 *
 * `setting` is a JSON string on the user row, not an object, so it is parsed
 * here and a malformed value is treated as unset rather than fatal.
 */
export function languageOf(setting: unknown): string | null {
  if (typeof setting !== "string" || setting.trim() === "") return null;
  try {
    const parsed = JSON.parse(setting) as { language?: unknown };
    return typeof parsed.language === "string" ? parsed.language : null;
  } catch {
    return null;
  }
}

/** The account's affiliate code, for the referral panel. */
export async function getAffiliateCode(accessToken: string): Promise<string> {
  const data = await call<string>("/api/user/aff", { token: accessToken });
  return typeof data === "string" ? data : "";
}

/* --- security proofs ----------------------------------------------------- */

/**
 * Obtains a short-lived proof authorising one sensitive action.
 *
 * new-api guards password changes, 2FA setup and access-token generation behind
 * a proof: `POST /api/verify` confirms the password and returns a token that is
 * sent back as `X-Security-Proof` on the action itself. The proof is scoped, so
 * one obtained for a password change cannot generate an access token.
 */
export async function obtainSecurityProof(
  accessToken: string,
  scope: string,
  password: string,
  context?: Record<string, unknown>,
): Promise<string> {
  const body: Record<string, unknown> = { method: "password", scope, password };
  if (context) body.context = context;
  const data = await call<{ proof_token: string }>("/api/verify", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify(body),
  });
  return data.proof_token;
}

/** Scopes accepted by `obtainSecurityProof`, mirroring the gateway's list. */
export const SECURITY_SCOPES = {
  passwordSet: "account.password.set",
  passwordChange: "account.password.change",
  twoFASetup: "2fa.setup",
  twoFADisable: "2fa.disable",
  twoFABackupCodes: "2fa.backup_codes.regenerate",
  accessTokenGenerate: "access_token.generate",
  accessTokenRevoke: "access_token.revoke",
  passkeyRegister: "passkey.register",
  passkeyDelete: "passkey.delete",
  accountBind: "account.binding.bind",
  accountUnbind: "account.binding.unbind",
  accountDelete: "account.delete",
} as const;

/**
 * Chooses the password scope for the account's current state.
 *
 * The gateway distinguishes setting a first password (`account.password.set`)
 * from changing one that exists (`account.password.change`), and rejects a proof
 * obtained for the wrong one.
 */
function passwordScopeFor(hasPassword: boolean): string {
  return hasPassword ? SECURITY_SCOPES.passwordChange : SECURITY_SCOPES.passwordSet;
}

/**
 * Changes the account password.
 *
 * The new password is checked for the same rules the gateway enforces (at least
 * eight characters) so the user gets a local answer, and the proof is what the
 * gateway actually requires. The response can carry a fresh access token when
 * the gateway advances the session; that is returned so the caller can persist
 * it, since changing the password invalidates the old one.
 */
export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ accessToken: string | null }> {
  // The scope depends on whether a password already exists, so the account is
  // read rather than assumed to have one.
  const user = await getUser(accessToken);
  const proof = await obtainSecurityProof(
    accessToken,
    passwordScopeFor(user.hasPassword),
    currentPassword,
  );

  const data = await call<{ access_token?: string }>("/api/user/self", {
    method: "PUT",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
    body: JSON.stringify({
      username: "",
      display_name: "",
      password: newPassword,
      original_password: currentPassword,
    }),
  });

  return { accessToken: data.access_token ?? null };
}

/* --- access token -------------------------------------------------------- */

export type AccessTokenStatus = {
  exists: boolean;
  tokenRef: string;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string;
};

export async function getAccessTokenStatus(accessToken: string): Promise<AccessTokenStatus> {
  const data = await call<{
    exists: boolean;
    token_ref: string;
    created_at: number | null;
    last_used_at: number | null;
    last_used_ip: string;
  }>("/api/user/token/status", { token: accessToken });

  return {
    exists: Boolean(data.exists),
    tokenRef: data.token_ref || "",
    createdAt: data.created_at ? new Date(data.created_at * 1000) : null,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at * 1000) : null,
    lastUsedIp: data.last_used_ip || "",
  };
}

/** Generates a fresh personal access token, replacing any existing one. */
export async function generateAccessToken(
  accessToken: string,
  password: string,
): Promise<string> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.accessTokenGenerate,
    password,
  );
  const data = await call<string>("/api/user/token", {
    method: "POST",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
  return typeof data === "string" ? data : "";
}

/** Revokes the personal access token. */
export async function revokeAccessToken(
  accessToken: string,
  password: string,
): Promise<void> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.accessTokenRevoke,
    password,
  );
  await call("/api/user/token", {
    method: "DELETE",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
}

/* --- two-factor authentication ------------------------------------------ */

export type TwoFactorStatus = {
  enabled: boolean;
  locked: boolean;
  /** How many unused backup codes remain; null when 2FA is off. */
  backupCodesRemaining: number | null;
};

export async function getTwoFactorStatus(accessToken: string): Promise<TwoFactorStatus> {
  const data = await call<{
    enabled?: boolean;
    locked?: boolean;
    backup_codes_remaining?: number;
  }>("/api/user/2fa/status", { token: accessToken });
  return {
    enabled: Boolean(data.enabled),
    locked: Boolean(data.locked),
    backupCodesRemaining:
      typeof data.backup_codes_remaining === "number" ? data.backup_codes_remaining : null,
  };
}

export type TwoFactorSetup = {
  secret: string;
  /** Data URI for the enrolment QR image, ready for an `<img src>`. */
  qrCodeData: string;
  backupCodes: string[];
  flowToken: string;
};

/** Begins 2FA enrolment, returning the secret and the QR image to scan. */
export async function setupTwoFactor(
  accessToken: string,
  password: string,
): Promise<TwoFactorSetup> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.twoFASetup,
    password,
  );
  const data = await call<{
    secret?: string;
    qr_code_data?: string;
    backup_codes?: string[];
    flow_token?: string;
  }>("/api/user/2fa/setup", {
    method: "POST",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });

  return {
    secret: data.secret || "",
    qrCodeData: data.qr_code_data || "",
    backupCodes: data.backup_codes ?? [],
    flowToken: data.flow_token || "",
  };
}

/** Completes 2FA enrolment with a code from the authenticator app. */
export async function enableTwoFactor(
  accessToken: string,
  flowToken: string,
  code: string,
): Promise<void> {
  await call("/api/user/2fa/enable", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ flow_token: flowToken, code }),
  });
}

/** Disables 2FA and clears its backup codes. */
export async function disableTwoFactor(
  accessToken: string,
  password: string,
): Promise<void> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.twoFADisable,
    password,
  );
  await call("/api/user/2fa/disable", {
    method: "POST",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
}

/** Replaces the two-factor backup codes, returning the new set. */
export async function regenerateBackupCodes(
  accessToken: string,
  password: string,
): Promise<string[]> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.twoFABackupCodes,
    password,
  );
  const data = await call<{ backup_codes?: string[] }>("/api/user/2fa/backup_codes", {
    method: "POST",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
  return data.backup_codes ?? [];
}

/* --- account deletion ---------------------------------------------------- */

/** Permanently deletes the account. Requires the password. */
export async function deleteAccount(accessToken: string, password: string): Promise<void> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.accountDelete,
    password,
  );
  await call("/api/user/self", {
    method: "DELETE",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
}

/* --- profile settings ---------------------------------------------------- */

/**
 * The notification and privacy preferences, in the shape the form edits.
 *
 * These live in the user's `setting` blob, but the gateway's setting endpoint
 * rebuilds that blob from this subset only, so `language` and `sidebar_modules`
 * are re-applied afterwards to avoid dropping them.
 */
export type NotificationSettings = {
  /** `email`, `webhook`, `bark` or `gotify`. */
  notifyType: string;
  quotaWarningThreshold: number;
  notificationEmail: string;
  webhookUrl: string;
  webhookSecret: string;
  barkUrl: string;
  gotifyUrl: string;
  gotifyToken: string;
  gotifyPriority: number;
  acceptUnsetModelRatioModel: boolean;
  recordIpLog: boolean;
  upstreamModelUpdateNotifyEnabled: boolean;
};

/** Persists notification/privacy preferences. */
export async function updateNotificationSettings(
  accessToken: string,
  settings: NotificationSettings,
): Promise<void> {
  const user = await getUser(accessToken);

  await call("/api/user/setting", {
    method: "PUT",
    token: accessToken,
    body: JSON.stringify({
      notify_type: settings.notifyType,
      quota_warning_threshold: settings.quotaWarningThreshold,
      notification_email: settings.notificationEmail,
      webhook_url: settings.webhookUrl,
      webhook_secret: settings.webhookSecret,
      bark_url: settings.barkUrl,
      gotify_url: settings.gotifyUrl,
      gotify_token: settings.gotifyToken,
      gotify_priority: settings.gotifyPriority,
      accept_unset_model_ratio_model: settings.acceptUnsetModelRatioModel,
      record_ip_log: settings.recordIpLog,
      upstream_model_update_notify_enabled: settings.upstreamModelUpdateNotifyEnabled,
    }),
  });

  // Restore the fields the setting endpoint does not carry.
  if (user.language) {
    await updateSelf(accessToken, { language: user.language }).catch(() => {});
  }
  if (user.sidebarModules) {
    await updateSidebarModules(accessToken, user.sidebarModules).catch(() => {});
  }
}

/** Stores the serialized sidebar-module preferences. */
export async function updateSidebarModules(
  accessToken: string,
  modules: string,
): Promise<void> {
  await call("/api/user/self", {
    method: "PUT",
    token: accessToken,
    body: JSON.stringify({ sidebar_modules: modules }),
  });
}

/* --- passkey and OAuth bindings ----------------------------------------- */

export type PasskeyStatus = {
  enabled: boolean;
  lastUsedAt: string | null;
  backupEligible: boolean;
  backupState: boolean;
};

export async function getPasskeyStatus(accessToken: string): Promise<PasskeyStatus> {
  const data = await call<{
    enabled?: boolean;
    last_used_at?: string | null;
    backup_eligible?: boolean;
    backup_state?: boolean;
  }>("/api/user/passkey", { token: accessToken });
  return {
    enabled: Boolean(data.enabled),
    lastUsedAt: data.last_used_at ?? null,
    backupEligible: Boolean(data.backup_eligible),
    backupState: Boolean(data.backup_state),
  };
}

/** The registration challenge to hand to `navigator.credentials.create`. */
export type PasskeyRegistrationBegin = {
  flowToken: string;
  options: unknown;
  rpIds: string[];
};

/** Begins passkey enrolment; requires the password to obtain a proof. */
export async function beginPasskeyRegistration(
  accessToken: string,
  password: string,
): Promise<PasskeyRegistrationBegin> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.passkeyRegister,
    password,
  );
  const data = await call<{ flow_token?: string; options?: unknown; rp_ids?: string[] }>(
    "/api/user/passkey/register/begin",
    { method: "POST", token: accessToken, headers: { "X-Security-Proof": proof } },
  );
  return {
    flowToken: data.flow_token || "",
    options: data.options ?? null,
    rpIds: data.rp_ids ?? [],
  };
}

/** Completes passkey enrolment with the created credential. */
export async function finishPasskeyRegistration(
  accessToken: string,
  flowToken: string,
  credential: Record<string, unknown>,
): Promise<void> {
  await call("/api/user/passkey/register/finish", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ flow_token: flowToken, credential }),
  });
}

/** Removes the registered passkey; requires the password. */
export async function deletePasskey(accessToken: string, password: string): Promise<void> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.passkeyDelete,
    password,
  );
  await call("/api/user/passkey", {
    method: "DELETE",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
}

export type OAuthBinding = { providerId: number; provider: string; externalId: string };

export async function listOAuthBindings(accessToken: string): Promise<OAuthBinding[]> {
  const data = await call<
    Array<{ provider_id: number; provider: string; external_id: string }>
  >("/api/user/oauth/bindings", { token: accessToken });

  return (data ?? []).map((row) => ({
    providerId: row.provider_id,
    provider: row.provider,
    externalId: row.external_id,
  }));
}

/** Unlinks a custom OAuth provider; requires the password. */
export async function unbindOAuth(
  accessToken: string,
  providerId: number,
  password: string,
): Promise<void> {
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.accountUnbind,
    password,
    { provider_id: providerId },
  );
  await call(`/api/user/oauth/bindings/${providerId}`, {
    method: "DELETE",
    token: accessToken,
    headers: { "X-Security-Proof": proof },
  });
}

/* --- relay (playground) -------------------------------------------------- */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

/**
 * Runs one completion through the relay.
 *
 * The relay authenticates with an `sk-` key, not the dashboard's access token,
 * so a throwaway key is created for the call and deleted immediately afterwards.
 * That keeps the user's own keys out of the browser and out of the request path;
 * the cost lands on the account either way, which is the intended behaviour.
 *
 * The delete runs in a `finally` so a failed completion cannot leave a stray key
 * behind. If the delete itself fails there is nothing useful to do about it — the
 * key is unlimited and unnamed, and the account owner can revoke it from the keys
 * screen.
 */
export async function runPlayground(
  accessToken: string,
  options: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number },
): Promise<ChatResult> {
  const { token: ephemeral, key } = await createToken(accessToken, "playground", {
    // Scope the throwaway key to the model being tried.
    models: [options.model],
  });

  try {
    const response = await fetch(url("/v1/chat/completions"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer sk-${key}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 1,
        max_tokens: options.maxTokens ?? 1024,
        stream: false,
      }),
    });

    const text = await response.text();
    let body: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
      error?: { message?: string };
    } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new GatewayError(`The relay returned a non-JSON response (HTTP ${response.status}).`, 502);
    }

    if (!response.ok || body.error) {
      throw new GatewayError(
        body.error?.message || `Relay error (HTTP ${response.status})`,
        response.status === 200 ? 400 : response.status,
      );
    }

    return {
      content: body.choices?.[0]?.message?.content ?? "",
      model: body.model || options.model,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
    };
  } finally {
    await deleteToken(accessToken, String(ephemeral.id)).catch(() => {});
  }
}

type RelayChunk = {
  model?: string;
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

export type PlaygroundStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; model: string; promptTokens: number; completionTokens: number };

/**
 * Same call as `runPlayground`, but streamed.
 *
 * The relay answers `text/event-stream`; each `data:` line carries one
 * OpenAI-style chunk. This generator unwraps the chunk to its text delta and
 * its trailing usage block. The throwaway key is deleted in a `finally`, which
 * runs whether the reader drained the stream or the caller closed early — the
 * latter is why the reader is cancelled in its own `finally`.
 */
export async function* streamPlayground(
  accessToken: string,
  options: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    /** Aborted when the browser closes the response early. */
    signal?: AbortSignal;
  },
): AsyncGenerator<PlaygroundStreamEvent> {
  const { token: ephemeral, key } = await createToken(accessToken, "playground", {
    models: [options.model],
  });

  try {
    const response = await fetch(url("/v1/chat/completions"), {
      method: "POST",
      cache: "no-store",
      signal: options.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer sk-${key}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 1,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      let message = `Relay error (HTTP ${response.status})`;
      try {
        const body = text ? (JSON.parse(text) as RelayEnvelope) : {};
        if (body.error?.message) message = body.error.message;
      } catch {
        /* keep the status message */
      }
      throw new GatewayError(message, response.status === 200 ? 400 : response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let model = options.model;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let chunk: RelayChunk;
          try {
            chunk = JSON.parse(data) as RelayChunk;
          } catch {
            continue;
          }
          if (chunk.error?.message) throw new GatewayError(chunk.error.message, 502);
          if (chunk.model) model = chunk.model;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield { type: "delta", content: delta };
          }
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
            completionTokens = chunk.usage.completion_tokens ?? completionTokens;
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    yield { type: "done", model, promptTokens, completionTokens };
  } finally {
    await deleteToken(accessToken, String(ephemeral.id)).catch(() => {});
  }
}

/**
 * A usable access token, renewing it when it is close to expiry.
 *
 * Returns the renewed session separately rather than writing it, because a
 * Server Component is not allowed to set a cookie. Route handlers pass the value
 * to `persistSession`; a Server Component uses the token for this render and
 * lets the next request renew again.
 */
export async function currentAccess(): Promise<
  { token: string; session: Session; renewed: Session | null } | null
> {
  const session = await readSession();
  if (!session) return null;

  if (!needsRefresh(session)) {
    return { token: session.accessToken, session, renewed: null };
  }

  const fresh = await renew(session);
  if (!fresh) return null;

  return { token: fresh.accessToken, session: fresh, renewed: fresh };
}

/** Writes the session cookie. Only valid in a route handler or server action. */
export async function persistSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, serialize(session), {
    ...(await cookieOptions()),
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Drops the session cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ---------------------------------------------------------------------- *
 * Admin surface
 *
 * These routes need `AdminAuth` (channels) or `RootAuth` (options) at the
 * gateway, so only the root account can drive them. They are reached from
 * this app's own /api/admin/* handlers; the browser never holds the token.
 * ---------------------------------------------------------------------- */

export type GatewayChannel = {
  id: number;
  name: string;
  type: number;
  status: number;
  /** Comma-separated group list, as new-api stores it. */
  group: string;
  models: string[];
  priority: number;
  weight: number;
};

/** Every channel, with keys omitted by the gateway. */
export async function listChannels(accessToken: string): Promise<GatewayChannel[]> {
  const data = await call<{ items: Array<Record<string, unknown>> }>(
    "/api/channel/?p=0&page_size=500",
    { token: accessToken },
  );
  return (data.items ?? []).map((raw) => ({
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    type: Number(raw.type ?? 0),
    status: Number(raw.status ?? 0),
    group: String(raw.group ?? ""),
    models: String(raw.models ?? "")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
    priority: Number(raw.priority ?? 0),
    weight: Number(raw.weight ?? 0),
  }));
}

/**
 * Edits a channel's routing fields.
 *
 * `models`, `group`, `priority` and `weight` only. Status is refused by this
 * route (the gateway rejects it in the body), and the key is never sent, so an
 * edit cannot drop it. For status use `setChannelStatus`.
 */
export async function updateChannel(
  accessToken: string,
  id: number,
  patch: { models?: string; group?: string; priority?: number; weight?: number },
): Promise<void> {
  await call("/api/channel/", {
    method: "PUT",
    token: accessToken,
    body: JSON.stringify({ id, ...patch }),
  });
}

/**
 * The gateway's raw option map. Values of JSON options are JSON strings.
 *
 * Pass `revalidate` for a public read that should be cached and shared: the
 * homepage needs the `vipai.meta` option inside a prerendered render, and an
 * uncached (`no-store`) fetch there turns the whole page dynamic. The admin
 * screens omit it and always read the stored value.
 */
export async function getOptions(
  accessToken: string,
  revalidate?: number,
): Promise<Map<string, string>> {
  const data = await call<Array<{ key: string; value: string }>>("/api/option/", {
    token: accessToken,
    revalidate,
  });
  return new Map((data ?? []).map((option) => [option.key, option.value]));
}

/** Writes one option. `value` is the raw string the gateway stores. */
export async function setOption(
  accessToken: string,
  key: string,
  value: string,
): Promise<void> {
  await call("/api/option/", {
    method: "PUT",
    token: accessToken,
    body: JSON.stringify({ key, value }),
  });
}

/** One admin usage row, as `/api/log/` reports it. */
export type GatewayAdminLog = {
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  quota: number;
  channel: number;
  created_at: number;
};

/** Recent usage across every account, newest first. */
export async function listAdminLogs(
  accessToken: string,
  pageSize = 1000,
): Promise<{ items: GatewayAdminLog[]; total: number }> {
  const data = await call<{ items: GatewayAdminLog[]; total: number }>(
    `/api/log/?p=0&page_size=${pageSize}`,
    { token: accessToken },
  );
  return { items: data.items ?? [], total: data.total ?? 0 };
}
