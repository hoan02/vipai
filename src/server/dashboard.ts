import "server-only";
import {
  getUsageSummary,
  listApiKeys,
  type ApiKeyRecord,
} from "./repositories";
import {
  balance,
  type ApiKey,
  type BillingRow,
  type UsagePoint,
  type UsageSummary,
} from "@/lib/dashboard-data";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const intFmt = new Intl.NumberFormat("en-US");
const usd = (value: number) => `$${value.toFixed(2)}`;

/**
 * Maps a backend key record to the view shape.
 *
 * The plugin returns `prefix` with its trailing separator already attached, so
 * the mask must not add another one.
 */
export function toViewKey(record: ApiKeyRecord): ApiKey {
  return {
    id: record.id,
    name: record.name,
    masked: `${record.prefix}••••••••${record.last4}`,
    status: record.enabled && !record.isExpired ? "Active" : "Revoked",
    created: dateFmt.format(record.createdAt),
    requests: null,
  };
}

/** API keys for the signed-in account. Empty when the account has none. */
export async function getDashboardKeys(): Promise<ApiKey[]> {
  const records = await listApiKeys();
  return records.map(toViewKey);
}

export type DashboardUsage = {
  summary: UsageSummary;
  series: UsagePoint[];
};

/** Token totals for the signed-in account. */
export async function getDashboardUsage(): Promise<DashboardUsage> {
  const usage = await getUsageSummary();

  return {
    summary: {
      input: intFmt.format(usage.tokensIn),
      output: intFmt.format(usage.tokensOut),
      // Cache tokens are not recorded in usage_events yet.
      cacheRead: "0",
      cacheWrite: "0",
    },
    // The backend reports account totals only; a daily series needs a new query.
    series: [],
  };
}

export type DashboardBilling = {
  balance: string | null;
  monthSpend: string;
  rows: BillingRow[];
};

/** Billing rows for the signed-in account. */
export async function getDashboardBilling(): Promise<DashboardBilling> {
  const usage = await getUsageSummary();

  return {
    balance,
    monthSpend: usd(usage.costUsd),
    rows: [],
  };
}
