import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";

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

const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  last4: true,
  createdAt: true,
  revokedAt: true,
} as const;

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
    name: "Staging",
    prefix: KEY_PREFIX,
    last4: "07d1",
    createdAt: new Date("2025-11-28T18:44:00Z"),
    revokedAt: new Date("2026-01-05T10:00:00Z"),
  },
];

const DEMO_USAGE: UsageSummary = {
  requests: 128_940,
  tokensIn: 1_284_000_000,
  tokensOut: 642_000_000,
  costUsd: 1_842.36,
  series: [
    { day: "Mon", tokensIn: 142, tokensOut: 71 },
    { day: "Tue", tokensIn: 168, tokensOut: 84 },
    { day: "Wed", tokensIn: 155, tokensOut: 79 },
    { day: "Thu", tokensIn: 191, tokensOut: 96 },
    { day: "Fri", tokensIn: 214, tokensOut: 108 },
    { day: "Sat", tokensIn: 126, tokensOut: 63 },
    { day: "Sun", tokensIn: 288, tokensOut: 141 },
  ],
};

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return `${KEY_PREFIX}-${randomBytes(24).toString("base64url")}`;
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  const db = await getDb();
  if (!db) return DEMO_KEYS;
  try {
    return (await db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: KEY_SELECT,
    })) as ApiKeyRecord[];
  } catch (error) {
    console.error("[aigiare] listApiKeys fell back to demo data:", error);
    return DEMO_KEYS;
  }
}

export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ key: string; record: ApiKeyRecord }> {
  const key = generateApiKey();
  const last4 = key.slice(-4);
  const db = await getDb();

  if (!db) {
    return {
      key,
      record: {
        id: `key_demo_${Date.now()}`,
        name,
        prefix: KEY_PREFIX,
        last4,
        createdAt: new Date(),
        revokedAt: null,
      },
    };
  }

  const record = (await db.apiKey.create({
    data: { userId, name, prefix: KEY_PREFIX, last4, hashedKey: hashKey(key) },
    select: KEY_SELECT,
  })) as ApiKeyRecord;

  return { key, record };
}

export async function setApiKeyRevoked(
  userId: string,
  id: string,
  revoked: boolean,
): Promise<ApiKeyRecord | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    return (await db.apiKey.update({
      where: { id, userId },
      data: { revokedAt: revoked ? new Date() : null },
      select: KEY_SELECT,
    })) as ApiKeyRecord;
  } catch (error) {
    console.error("[aigiare] setApiKeyRevoked failed:", error);
    return null;
  }
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const db = await getDb();
  if (!db) return DEMO_USAGE;
  try {
    const rows = (await db.usageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    })) as Array<{ tokensIn: number; tokensOut: number; costUsd: unknown; createdAt: Date }>;

    if (rows.length === 0) return { requests: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, series: [] };

    const byDay = new Map<string, UsagePoint>();
    for (const row of rows) {
      const day = row.createdAt.toLocaleDateString("en-US", { weekday: "short" });
      const point = byDay.get(day) ?? { day, tokensIn: 0, tokensOut: 0 };
      point.tokensIn += Math.round(row.tokensIn / 1_000_000);
      point.tokensOut += Math.round(row.tokensOut / 1_000_000);
      byDay.set(day, point);
    }

    return {
      requests: rows.length,
      tokensIn: rows.reduce((sum, r) => sum + r.tokensIn, 0),
      tokensOut: rows.reduce((sum, r) => sum + r.tokensOut, 0),
      costUsd: rows.reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0),
      series: [...byDay.values()],
    };
  } catch (error) {
    console.error("[aigiare] getUsageSummary fell back to demo data:", error);
    return DEMO_USAGE;
  }
}

export type UsageRow = {
  id: string;
  model: string;
  source: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  createdAt: Date;
};

/** Most recent billed requests, newest first. Empty when no database is set. */
export async function listRecentUsage(userId: string, limit = 20): Promise<UsageRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = (await db.usageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })) as Array<{
      id: string;
      model: string;
      tokensIn: number;
      tokensOut: number;
      costUsd: unknown;
      createdAt: Date;
      apiKey?: { name: string } | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      model: row.model,
      source: row.apiKey?.name ?? "API",
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      costUsd: Number(row.costUsd ?? 0),
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[aigiare] listRecentUsage fell back to demo data:", error);
    return [];
  }
}

export async function createTokenRequest(input: TokenRequestInput): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.info("[aigiare] test-token request (no database configured):", {
      email: input.email,
      telegram: input.telegram ?? null,
    });
    return;
  }
  try {
    await db.tokenRequest.create({
      data: {
        email: input.email,
        telegram: input.telegram ?? null,
        useCase: input.useCase ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    console.error("[aigiare] createTokenRequest failed:", error);
  }
}
