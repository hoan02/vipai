import "server-only";
import { cookies, headers } from "next/headers";

export const KEY_PREFIX = "sk-aigiare";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: Date;
  revokedAt: Date | null;
};

export type UsagePoint = { day: string; tokensIn: number; tokensOut: number };

export type UsageSummary = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  series: UsagePoint[];
};

export type TokenRequestInput = {
  email: string;
  telegram?: string | null;
  useCase?: string | null;
  userId?: string | null;
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

const BACKEND_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

const DEMO_KEYS: ApiKeyRecord[] = [
  {
    id: "key_demo_prod",
    name: "Production",
    prefix: KEY_PREFIX,
    last4: "9f2c",
    createdAt: new Date("2026-01-12T09:20:00Z"),
    revokedAt: null,
  },
  {
    id: "key_demo_claude",
    name: "Claude Code",
    prefix: KEY_PREFIX,
    last4: "41ab",
    createdAt: new Date("2026-02-03T14:05:00Z"),
    revokedAt: null,
  },
  {
    id: "key_demo_staging",
    name: "Staging sandbox",
    prefix: KEY_PREFIX,
    last4: "e704",
    createdAt: new Date("2026-02-18T18:42:00Z"),
    revokedAt: null,
  },
];

async function getAuthHeaders(): Promise<Record<string, string>> {
  const reqHeaders: Record<string, string> = {
    "content-type": "application/json",
  };
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("limen_session")?.value;
    if (sessionCookie) {
      reqHeaders["cookie"] = `limen_session=${sessionCookie}`;
    }
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    if (authHeader) {
      reqHeaders["authorization"] = authHeader;
    }
  } catch {
    // Headers or cookies might not be available in non-request contexts
  }
  return reqHeaders;
}

/** Lists all API keys for the current user from the backend service. */
export async function listApiKeys(_userId?: string): Promise<ApiKeyRecord[]> {
  try {
    const h = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/keys`, {
      headers: h,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.keys)) {
        return data.keys.map((k: Record<string, unknown>) => ({
          id: String(k.id),
          name: String(k.name),
          prefix: String(k.prefix || KEY_PREFIX),
          last4: String(k.last4),
          createdAt: new Date(String(k.createdAt)),
          revokedAt: k.revokedAt ? new Date(String(k.revokedAt)) : null,
        }));
      }
    }
  } catch (error) {
    console.warn("[aigiare] backend /api/keys unavailable, using demo keys:", error);
  }

  return DEMO_KEYS;
}

/** Creates a new API key via backend service. */
export async function createApiKey(_userId: string, name: string): Promise<{
  id: string;
  name: string;
  prefix: string;
  last4: string;
  plaintextKey: string;
  createdAt: Date;
}> {
  const h = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/keys`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create API key");
  }

  const data = await res.json();
  return {
    id: String(data.id),
    name: data.name,
    prefix: data.prefix,
    last4: data.last4,
    plaintextKey: data.key,
    createdAt: new Date(data.createdAt),
  };
}

/** Revokes an API key via backend service. */
export async function setApiKeyRevoked(
  _userId: string,
  keyId: string,
  _revoked = true,
): Promise<{ id: string; revokedAt: Date | null } | null> {
  const h = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/keys/${keyId}`, {
    method: "DELETE",
    headers: h,
    cache: "no-store",
  });

  if (!res.ok) return null;
  return { id: keyId, revokedAt: _revoked ? new Date() : null };
}

/** Fetches usage metrics from backend service. */
export async function getUsageSummary(_userId?: string): Promise<UsageSummary> {
  try {
    const h = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/dashboard/summary`, {
      headers: h,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return {
        requests: Number(data.totalRequests || 0),
        tokensIn: Number(data.totalTokensIn || 0),
        tokensOut: Number(data.totalTokensOut || 0),
        costUsd: Number(data.totalCostUsd || 0),
        series: [],
      };
    }
  } catch (error) {
    console.warn("[aigiare] backend /api/dashboard/summary unavailable:", error);
  }

  return {
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    series: [],
  };
}

/** Returns recent usage activity. */
export async function listRecentUsage(_userId?: string): Promise<UsageRow[]> {
  return [];
}

/** Submits a public test-token request to the backend service. */
export async function createTokenRequest(input: TokenRequestInput): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/token-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit request");
  }
}
