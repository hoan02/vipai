import "server-only";

import { listApiKeys, listUsage, toUsageRow, type ApiKeyRecord } from "./repositories";
import { QUOTA_PER_USD } from "./gateway";
import {
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
 * Maps a gateway key record to the view shape.
 *
 * The gateway masks the middle of the value itself, so the view renders it
 * verbatim rather than composing a mask of its own.
 */
export function toViewKey(record: ApiKeyRecord): ApiKey {
  return {
    id: record.id,
    name: record.name,
    masked: record.masked,
    status: record.enabled && !record.isExpired ? "Active" : "Revoked",
    created: dateFmt.format(record.createdAt),
    requests: null,
  };
}

/** API keys for the signed-in account. Empty when the account has none. */
export async function getDashboardKeys(): Promise<ApiKey[]> {
  return (await listApiKeys()).map(toViewKey);
}

export type DashboardUsage = {
  summary: UsageSummary;
  series: UsagePoint[];
};

/** Token totals for the signed-in account, and a per-day series. */
export async function getDashboardUsage(): Promise<DashboardUsage> {
  const { logs } = await listUsage();
  const rows = logs.map(toUsageRow);

  const byDay = new Map<string, UsagePoint>();
  for (const row of rows) {
    const day = String(row.createdAt.getDate());
    const point = byDay.get(day) ?? { day, input: 0, output: 0 };
    // The chart plots thousands of tokens.
    point.input += row.tokensIn / 1000;
    point.output += row.tokensOut / 1000;
    byDay.set(day, point);
  }

  const series = [...byDay.values()]
    .map((point) => ({
      day: point.day,
      input: Math.round(point.input * 10) / 10,
      output: Math.round(point.output * 10) / 10,
    }))
    .sort((a, b) => Number(a.day) - Number(b.day));

  return {
    summary: {
      input: intFmt.format(rows.reduce((total, row) => total + row.tokensIn, 0)),
      output: intFmt.format(rows.reduce((total, row) => total + row.tokensOut, 0)),
      // The gateway does not report cache tokens as a separate column in this
      // release, so they are not shown rather than shown as zero.
      cacheRead: "0",
      cacheWrite: "0",
    },
    series,
  };
}

export type DashboardBilling = {
  balance: string | null;
  monthSpend: string;
  rows: BillingRow[];
};

/** Balance, spend and recent charges for the signed-in account. */
export async function getDashboardBilling(): Promise<DashboardBilling> {
  const { user, logs } = await listUsage();
  const rows = logs.map(toUsageRow);

  // The gateway reports only the current balance, so the balance shown against
  // each row is reconstructed by adding back the charges that came after it.
  // Rows are newest first, so the newest row shows the balance as it stands.
  let spentAfter = 0;
  const table: BillingRow[] = rows.map((row) => {
    const balanceAtRow = user.quota / QUOTA_PER_USD + spentAfter;
    spentAfter += row.costUsd;

    return {
      time: timeFmt.format(row.createdAt),
      model: row.model,
      source: row.source,
      input: intFmt.format(row.tokensIn),
      output: intFmt.format(row.tokensOut),
      cacheRead: "0",
      cacheWrite: "0",
      amount: usd(row.costUsd),
      balance: usd(balanceAtRow),
    };
  });

  return {
    balance: usd(user.quota / QUOTA_PER_USD),
    monthSpend: usd(user.usedQuota / QUOTA_PER_USD),
    rows: table,
  };
}
