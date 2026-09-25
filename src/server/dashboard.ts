import "server-only";
import { hasDatabase } from "./db";
import {
  getUsageSummary,
  listApiKeys,
  listRecentUsage,
  type ApiKeyRecord,
  type UsageRow,
} from "./repositories";
import {
  apiKeys as demoKeys,
  billingRows as demoBillingRows,
  monthSpend as demoMonthSpend,
  usageSeries as demoSeries,
  usageSummary as demoSummary,
  type ApiKey,
  type BillingRow,
} from "@/lib/dashboard-data";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const intFmt = new Intl.NumberFormat("en-US");
const usd = (value: number) => `$${value.toFixed(2)}`;

export function toViewKey(record: ApiKeyRecord): ApiKey {
  return {
    id: record.id,
    name: record.name,
    masked: `${record.prefix}-••••••••${record.last4}`,
    status: record.revokedAt ? "Revoked" : "Active",
    created: dateFmt.format(new Date(record.createdAt)),
    requests: "—",
  };
}

/** API keys for the signed-in account; demo rows when no database is attached. */
export async function getDashboardKeys(userId: string): Promise<ApiKey[]> {
  if (!hasDatabase) return demoKeys;
  const records = await listApiKeys(userId);
  return records.map(toViewKey);
}

export type DashboardUsage = {
  summary: typeof demoSummary;
  series: typeof demoSeries;
};

/** Usage cards + 14-day series. Cache counters stay demo: the schema has no field for them. */
export async function getDashboardUsage(userId: string): Promise<DashboardUsage> {
  if (!hasDatabase) return { summary: demoSummary, series: demoSeries };

  const usage = await getUsageSummary(userId);
  if (usage.series.length === 0) return { summary: demoSummary, series: demoSeries };

  return {
    summary: {
      input: intFmt.format(usage.tokensIn),
      output: intFmt.format(usage.tokensOut),
      cacheRead: demoSummary.cacheRead,
      cacheWrite: demoSummary.cacheWrite,
    },
    series: usage.series.map((point) => ({ day: point.day, input: point.tokensIn, output: point.tokensOut })),
  };
}

export type DashboardBilling = {
  monthSpend: string;
  rows: BillingRow[];
};

function toViewBillingRow(row: UsageRow): BillingRow {
  return {
    time: timeFmt.format(new Date(row.createdAt)),
    model: row.model,
    source: row.source,
    input: intFmt.format(row.tokensIn),
    output: intFmt.format(row.tokensOut),
    cacheRead: "—",
    cacheWrite: "—",
    amount: usd(row.costUsd),
    balance: `−${usd(row.costUsd)}`,
  };
}

/** Billing rows + month spend from real usage events; demo rows when empty. */
export async function getDashboardBilling(userId: string): Promise<DashboardBilling> {
  if (!hasDatabase) return { monthSpend: demoMonthSpend, rows: demoBillingRows };

  const [usage, recent] = await Promise.all([getUsageSummary(userId), listRecentUsage(userId)]);
  if (recent.length === 0) return { monthSpend: demoMonthSpend, rows: demoBillingRows };

  return { monthSpend: usd(usage.costUsd), rows: recent.map(toViewBillingRow) };
}
