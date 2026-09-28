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
 * Performs one gateway call and normalises its result.
 *
 * Always sends the user id alongside the token: the management API resolves
 * permissions from that header, and omitting it makes admin routes behave as if
 * the caller were nobody.
 */
async function call<T>(
  path: string,
  init: RequestInit & { token?: string; cookie?: string } = {},
): Promise<T> {
  const { token, cookie, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body !== undefined) headers.set("content-type", "application/json");

  // Forward the caller's address so the gateway's per-IP rate limiter counts the
  // visitor, not this server. Every call leaves from one container IP otherwise,
  // so unrelated people would share a single bucket and trip it for each other.
  const forwardedFor = await getForwardedFor();
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
    const sub = subjectOf(token);
    if (sub) headers.set("new-api-user", sub);
  }
  if (cookie) headers.set("cookie", cookie);

  let response: Response;
  try {
    response = await fetch(url(path), { ...rest, headers, cache: "no-store" });
  } catch (cause) {
    throw new GatewayError(
      `Could not reach the gateway: ${(cause as Error).message}`,
      503,
    );
  }

  const text = await response.text();
  let body: Envelope<T> & RelayEnvelope = {};
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
  };
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
export type PagedLogs = {
  items: GatewayLog[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listLogsPaged(
  accessToken: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<PagedLogs> {
  const page = Math.max(0, options.page ?? 0);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const data = await call<{
    items: GatewayLog[];
    page: number;
    page_size: number;
    total: number;
  }>(`/api/log/self?p=${page}&page_size=${pageSize}`, { token: accessToken });

  return {
    items: data.items ?? [],
    page: data.page ?? page,
    pageSize: data.page_size ?? pageSize,
    total: data.total ?? 0,
  };
}

/** The account's own usage rollup: quota spent, requests per minute, tokens per minute. */
export type SelfLogStat = { quota: number; rpm: number; tpm: number };

export async function getLogStat(accessToken: string): Promise<SelfLogStat> {
  const data = await call<SelfLogStat>("/api/log/self/stat", { token: accessToken });
  return { quota: data.quota ?? 0, rpm: data.rpm ?? 0, tpm: data.tpm ?? 0 };
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
): Promise<string> {
  const data = await call<{ proof_token: string }>("/api/verify", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ method: "password", scope, password }),
  });
  return data.proof_token;
}

/** Scopes accepted by `obtainSecurityProof`, mirroring the gateway's list. */
export const SECURITY_SCOPES = {
  passwordChange: "account.password.change",
  twoFAEnable: "account.2fa.enable",
  twoFADisable: "account.2fa.disable",
  accessTokenGenerate: "account.access_token.generate",
  accessTokenRevoke: "account.access_token.revoke",
} as const;

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
  const proof = await obtainSecurityProof(
    accessToken,
    SECURITY_SCOPES.passwordChange,
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

export type TwoFactorStatus = { enabled: boolean; locked: boolean };

export async function getTwoFactorStatus(accessToken: string): Promise<TwoFactorStatus> {
  const data = await call<{ enabled?: boolean; locked?: boolean }>("/api/user/2fa/status", {
    token: accessToken,
  });
  return { enabled: Boolean(data.enabled), locked: Boolean(data.locked) };
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
    SECURITY_SCOPES.twoFAEnable,
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

/* --- passkey and OAuth bindings ----------------------------------------- */

export type PasskeyStatus = { enabled: boolean };

export async function getPasskeyStatus(accessToken: string): Promise<PasskeyStatus> {
  const data = await call<{ enabled?: boolean }>("/api/user/passkey", { token: accessToken });
  return { enabled: Boolean(data.enabled) };
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

/** The gateway's raw option map. Values of JSON options are JSON strings. */
export async function getOptions(accessToken: string): Promise<Map<string, string>> {
  const data = await call<Array<{ key: string; value: string }>>("/api/option/", {
    token: accessToken,
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
