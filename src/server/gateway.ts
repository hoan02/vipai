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
};

export type GatewayLog = {
  id: number;
  created_at: number;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  quota: number;
  token_name: string;
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
): Promise<{ token: GatewayToken; key: string }> {
  const before = await listTokens(accessToken);
  const known = new Set(before.map((token) => token.id));

  await call("/api/token/", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({
      name,
      remain_quota: 0,
      unlimited_quota: true,
      expired_time: -1,
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
