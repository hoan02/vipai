import "server-only";

import {
  GatewayError,
  QUOTA_PER_USD,
  createToken,
  currentAccess,
  deleteToken,
  getUser,
  listLogs,
  listTokens,
  persistSession,
  setTokenEnabled,
  type GatewayLog,
  type GatewayToken,
} from "./gateway";

/**
 * The gateway's key and usage records, shaped for the views.
 *
 * Everything here is the account's own data, resolved with the session this app
 * holds. There is no separate user store: new-api owns users, keys, quota and
 * logs, and this module is only a translation layer between its field names and
 * the ones the dashboard already renders.
 */

/** The prefix new-api shows on a key. Kept here so views do not spell it out. */
export const KEY_PREFIX = "sk-";

/** new-api's token status column. */
const TOKEN_ENABLED = 1;
const TOKEN_DISABLED = 2;
const TOKEN_EXPIRED = 3;
const TOKEN_EXHAUSTED = 4;

/** An API key owned by the signed-in account. */
export type ApiKeyRecord = {
  id: string;
  name: string;
  /** Ready to display: the gateway masks the middle already. */
  masked: string;
  enabled: boolean;
  isExpired: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  usedUsd: number;
  /** Billing group; empty means the account default. */
  group: string;
  /** Model allow-list, empty when the key may use everything. */
  models: string[];
  /** Source addresses the key accepts, empty means any. */
  allowIps: string;
  /** -1 means the key never expires. */
  expiresAt: Date | null;
};

/**
 * Resolves a usable access token, persisting a renewed one when possible.
 *
 * A Server Component cannot set a cookie, so the write is attempted and
 * discarded rather than allowed to fail the render. A route handler persists it,
 * which is what keeps the token fresh across a browsing session.
 */
export async function requireAccessToken(): Promise<string> {
  const access = await currentAccess();
  if (!access) throw new GatewayError("Not signed in", 401);

  if (access.renewed) {
    try {
      await persistSession(access.renewed);
    } catch {
      // Outside a route handler. The token is still valid for this render.
    }
  }

  return access.token;
}

function toRecord(token: GatewayToken, now = Date.now()): ApiKeyRecord {
  const expired =
    token.status === TOKEN_EXPIRED ||
    token.status === TOKEN_EXHAUSTED ||
    (token.expired_time > 0 && token.expired_time * 1000 <= now);

  return {
    id: String(token.id),
    name: token.name,
    masked: `${KEY_PREFIX}${token.key}`,
    enabled: token.status === TOKEN_ENABLED,
    isExpired: expired,
    createdAt: new Date(token.created_time * 1000),
    // The gateway writes 0 for a key that has never been used.
    lastUsedAt: token.accessed_time > 0 ? new Date(token.accessed_time * 1000) : null,
    usedUsd: (token.used_quota ?? 0) / QUOTA_PER_USD,
    group: token.group || "",
    models: (token.model_limits ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    allowIps: token.allow_ips ?? "",
    // -1 (never) is represented as null rather than a date in 1969.
    expiresAt: token.expired_time > 0 ? new Date(token.expired_time * 1000) : null,
  };
}

/** Lists the API keys owned by the signed-in account. */
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const token = await requireAccessToken();
  return (await listTokens(token)).map((record) => toRecord(record));
}

/**
 * Creates an API key.
 *
 * The plaintext value is returned once, at creation, and is never stored here.
 * It is not recoverable from the list, which returns a mask; the gateway only
 * parts with the real value through its own reveal route, which this calls
 * immediately after creating.
 */
export async function createApiKey(
  name: string,
  options: {
    models?: string[];
    group?: string;
    allowIps?: string;
    /** Days until expiry; 0 or undefined means never. */
    expiresInDays?: number;
  } = {},
): Promise<{ record: ApiKeyRecord; plaintextKey: string }> {
  const token = await requireAccessToken();
  const expiredTime =
    options.expiresInDays && options.expiresInDays > 0
      ? Math.floor(Date.now() / 1000) + options.expiresInDays * 24 * 60 * 60
      : -1;

  const { token: created, key } = await createToken(token, name, {
    models: options.models,
    group: options.group,
    allowIps: options.allowIps,
    expiredTime,
  });
  return { record: toRecord(created), plaintextKey: `${KEY_PREFIX}${key}` };
}

/**
 * Revokes an API key.
 *
 * The gateway deletes the row, so this is permanent: a revoked key cannot be
 * brought back and its name becomes available again. For a reversible "disable",
 * use `updateApiKey(id, { enabled: false })`.
 */
export async function revokeApiKey(id: string): Promise<void> {
  const token = await requireAccessToken();
  await deleteToken(token, id);
}

/** Not supported: see `setTokenEnabled`. The gateway can only revoke a key. */
export async function updateApiKey(
  id: string,
  patch: { enabled?: boolean },
): Promise<ApiKeyRecord> {
  const token = await requireAccessToken();
  if (typeof patch.enabled !== "boolean") {
    throw new GatewayError("Only the enabled flag can be changed.", 400);
  }
  return toRecord(await setTokenEnabled(token, id, patch.enabled));
}

export type UsageSummary = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Unspent balance, in US dollars. */
  balanceUsd: number;
};

export type UsageRow = {
  id: string;
  createdAt: Date;
  model: string;
  source: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/** The most recent usage rows, up to the gateway's page cap. */
export async function listUsage(): Promise<{ user: Awaited<ReturnType<typeof getUser>>; logs: GatewayLog[] }> {
  const token = await requireAccessToken();
  const [user, logs] = await Promise.all([getUser(token), listLogs(token, 100)]);
  return { user, logs };
}

export function toUsageRow(log: GatewayLog): UsageRow {
  return {
    id: String(log.id),
    createdAt: new Date(log.created_at * 1000),
    model: log.model_name || "unknown",
    source: log.token_name || "default",
    tokensIn: log.prompt_tokens ?? 0,
    tokensOut: log.completion_tokens ?? 0,
    costUsd: (log.quota ?? 0) / QUOTA_PER_USD,
  };
}

/**
 * Totals for the signed-in account.
 *
 * The request count and the spend come from the account record, which is
 * authoritative. Token counts are not stored per account, so they are summed
 * over the most recent page of usage rows; a very heavy account would need
 * pagination to be exact, and the figure is presented as recent activity rather
 * than a lifetime total.
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const { user, logs } = await listUsage();

  return {
    requests: user.requestCount,
    tokensIn: logs.reduce((total, log) => total + (log.prompt_tokens ?? 0), 0),
    tokensOut: logs.reduce((total, log) => total + (log.completion_tokens ?? 0), 0),
    costUsd: user.usedQuota / QUOTA_PER_USD,
    balanceUsd: user.quota / QUOTA_PER_USD,
  };
}
