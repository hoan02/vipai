import "server-only";
import { z } from "zod";
import { authApiHeaders, getForwardedFor, BACKEND_URL } from "./http";
import { backend } from "./backend";
import { isAPIError } from "@/lib/backend-client";

export const KEY_PREFIX = "sk-aigiare-";

/**
 * Limen's api-key plugin payload.
 *
 * Validated rather than cast: a key silently dropped from the table is worse than
 * a loud failure, and this is the one response that is not covered by the
 * generated Encore client.
 */
const pluginApiKey = z.object({
  id: z.string().min(1),
  name: z.string(),
  prefix: z.string().min(1).default(KEY_PREFIX),
  last4: z.string().default(""),
  enabled: z.boolean(),
  is_expired: z.boolean(),
  last_used_at: z.string().nullable().optional(),
  created_at: z.string(),
});

const pluginApiKeyList = z.object({
  items: z.array(pluginApiKey),
});

/** An API key owned by the signed-in account. */
export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  enabled: boolean;
  isExpired: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function authApi(path: string): string {
  return `${BACKEND_URL}${path}`;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toRecord(key: z.infer<typeof pluginApiKey>): ApiKeyRecord {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    last4: key.last4,
    enabled: key.enabled,
    isExpired: key.is_expired,
    createdAt: toDate(key.created_at) ?? new Date(0),
    lastUsedAt: toDate(key.last_used_at),
  };
}

async function authApiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message || fallback);
}

/** Lists the API keys owned by the signed-in account. */
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const res = await fetch(authApi("/auth/api-keys?per_page=100"), {
    headers: await authApiHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await authApiError(res, "Could not load API keys");
  }

  const parsed = pluginApiKeyList.parse(await res.json());
  return parsed.items
    .map(toRecord)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Creates an API key. The plaintext key is returned exactly once and is never
 * stored, so it cannot be shown again.
 */
export async function createApiKey(
  name: string,
): Promise<{ record: ApiKeyRecord; plaintextKey: string }> {
  const res = await fetch(authApi("/auth/api-keys"), {
    method: "POST",
    headers: await authApiHeaders(),
    body: JSON.stringify({ name }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await authApiError(res, "Could not create the API key");
  }

  const body = (await res.json()) as Record<string, unknown>;
  const key = pluginApiKey.parse(body);
  if (typeof body.key !== "string" || body.key === "") {
    throw new Error("The backend did not return the new key");
  }

  return { record: toRecord(key), plaintextKey: body.key };
}

/**
 * Revokes an API key.
 *
 * The plugin's Revoke deletes the row, so this is permanent: a revoked key
 * cannot be brought back and its name becomes available again. For a reversible
 * "disable", use `updateApiKey(id, { enabled: false })`.
 */
export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(authApi(`/auth/api-keys/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: await authApiHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await authApiError(res, "Could not revoke the API key");
  }
}

/** Updates an API key in place, e.g. to disable or re-enable it. */
export async function updateApiKey(
  id: string,
  patch: { name?: string; enabled?: boolean },
): Promise<ApiKeyRecord> {
  const res = await fetch(authApi(`/auth/api-keys/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: await authApiHeaders(),
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await authApiError(res, "Could not update the API key");
  }

  return toRecord(pluginApiKey.parse(await res.json()));
}

export type UsageSummary = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
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

export type TokenRequestInput = {
  email: string;
  telegram?: string | null;
  useCase?: string | null;
};

/** Fetches usage totals for the signed-in account. */
export async function getUsageSummary(): Promise<UsageSummary> {
  try {
    const data = await backend().dashboard.Summary();
    return {
      requests: data.totalRequests,
      tokensIn: data.totalTokensIn,
      tokensOut: data.totalTokensOut,
      costUsd: data.totalCostUsd,
    };
  } catch (error) {
    if (isAPIError(error) && error.status === 401) {
      throw new Error("Not signed in");
    }
    throw error;
  }
}

/** Submits a public test-token request. */
export async function createTokenRequest(input: TokenRequestInput): Promise<void> {
  await backend().tokenrequests.Create({
    email: input.email,
    telegram: input.telegram ?? "",
    useCase: input.useCase ?? "",
    website: "",
    ForwardedFor: await getForwardedFor(),
  });
}
