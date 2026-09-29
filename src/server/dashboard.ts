import "server-only";

import {
  KEY_PREFIX,
  listApiKeys,
  requireAccessToken,
  type ApiKeyRecord,
} from "./repositories";
import {
  QUOTA_PER_USD,
  getPerfSummary,
  getQuotaData,
  getQuotaDataSelf,
  getStatus,
  getUser,
  getUserModels,
  getUptimeStatus,
  listLogs,
  listTokens,
  type GatewayAnnouncement,
  type GatewayApiInfo,
  type GatewayFaq,
  type GatewayLog,
  type GatewayPerfModel,
  type GatewayQuotaDatum,
  type GatewayQuotaPoint,
  type GatewayStatus,
  type GatewayToken,
  type GatewayUptimeGroup,
} from "./gateway";
import { API_BASE } from "@/lib/site";
import {
  TIME_RANGE_BY_GRANULARITY,
  computeTimeRange,
  type QuotaAnalyticsInitial,
  type TimeGranularity,
} from "@/lib/analytics";
import { type ApiKey } from "@/lib/dashboard-data";

/**
 * Maps a gateway key record to the view shape.
 *
 * The gateway masks the middle of the value itself, so the view renders it
 * verbatim rather than composing a mask of its own.
 */
export function toViewKey(record: ApiKeyRecord): ApiKey {
  const statusText = record.isExpired
    ? "Expired"
    : record.enabled
      ? "Active"
      : "Disabled";

  return {
    id: record.id,
    name: record.name,
    masked: record.masked,
    statusText,
    created: record.createdAt.toISOString(),
    requests: null,
    usedUsd: record.usedUsd,
    group: record.group,
    models: record.models,
    allowIps: record.allowIps,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
  };
}

/** API keys for the signed-in account. Empty when the account has none. */
export async function getDashboardKeys(): Promise<ApiKey[]> {
  return (await listApiKeys()).map(toViewKey);
}

/* --- overview ------------------------------------------------------------ */

/** Buckets the 24-hour usage sparkline is drawn from. */
const OVERVIEW_BUCKETS = 12;
/** The gateway's token status column for an enabled key. */
const TOKEN_ENABLED = 1;

/** A key the Overview can offer for the ready-to-run request example. */
export type OverviewKey = { id: string; name: string; masked: string };

/** The console panels, with the flags that decide whether each renders. */
export type OverviewStatus = {
  apiInfoEnabled: boolean;
  announcementsEnabled: boolean;
  faqEnabled: boolean;
  uptimeKumaEnabled: boolean;
  apiInfo: GatewayApiInfo[];
  announcements: GatewayAnnouncement[];
  faq: GatewayFaq[];
};

/** The last-24-hours performance rollup. */
export type OverviewPerformance = {
  successRate: number | null;
  avgLatencyMs: number | null;
  avgTps: number | null;
  models: GatewayPerfModel[];
};

/** Everything the Overview page renders, resolved from the gateway. */
export type DashboardOverview = {
  balanceUsd: number;
  usedUsd: number;
  requestCount: number;
  keyCount: number;
  preferredKey: OverviewKey | null;
  /** First allowed model, used by the request example. */
  model: string | null;
  /** Full chat-completions URL a customer would call. */
  endpoint: string;
  usage24hUsd: number;
  /** Quota spent per bucket over 24 hours, in US dollars. */
  usage24hSeries: number[];
  status: OverviewStatus;
  performance: OverviewPerformance;
  uptime: GatewayUptimeGroup[];
};

function preferredKeyOf(tokens: GatewayToken[]): OverviewKey | null {
  const token = tokens.find((item) => item.status === TOKEN_ENABLED) ?? tokens[0];
  if (!token) return null;
  return { id: String(token.id), name: token.name, masked: `${KEY_PREFIX}${token.key}` };
}

/**
 * The URL a customer calls.
 *
 * A configured API-info route wins, because that is the address the operator
 * advertises. Otherwise the known gateway hostname is used: the relay lives on
 * its own origin, so the site's own origin would be the wrong thing to paste
 * into a client.
 */
function relayEndpoint(status: GatewayStatus | null): string {
  const configured = status?.apiInfo.find((item) => item.url.trim())?.url.trim();
  if (configured) {
    const trimmed = configured.replace(/\/+$/, "");
    if (trimmed.endsWith("/v1/chat/completions")) return trimmed;
    if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
  }
  return `https://${API_BASE}/v1/chat/completions`;
}

/** Sums quota into fixed buckets across the window, as US dollars. */
function buildUsageSeries(points: GatewayQuotaPoint[], start: number, end: number): number[] {
  const series = Array.from({ length: OVERVIEW_BUCKETS }, () => 0);
  if (end <= start) return series;

  for (const point of points) {
    const ratio = (point.createdAt - start) / (end - start);
    const index = Math.min(OVERVIEW_BUCKETS - 1, Math.max(0, Math.floor(ratio * OVERVIEW_BUCKETS)));
    series[index] += point.quota;
  }
  return series.map((quota) => quota / QUOTA_PER_USD);
}

/**
 * A fallback for the 24-hour window when the usage-dashboard data is empty.
 *
 * `/api/data/self` reads the `quota_data` rollup, which the gateway only writes
 * when its Data-export setting is on. When that setting is off the endpoint
 * answers an empty list even though the account has traffic, so the raw log is
 * summed instead. The log is capped at one page, which is exact for a light
 * account and a slight undercount for a very busy one.
 */
async function logsAsPoints(token: string, startSec: number): Promise<GatewayQuotaPoint[]> {
  const logs = await listLogs(token, 100).catch(() => [] as GatewayLog[]);
  return logs
    .filter((log) => (log.created_at ?? 0) >= startSec)
    .map((log) => ({
      createdAt: log.created_at,
      quota: log.quota ?? 0,
      count: 1,
      tokens: (log.prompt_tokens ?? 0) + (log.completion_tokens ?? 0),
      model: log.model_name || "unknown",
    }));
}

/**
 * Everything the Overview renders, in one server pass.
 *
 * The account and key data is essential; the console panels, performance rollup
 * and usage buckets are conveniences, so each degrades to an empty state rather
 * than failing the page.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const token = await requireAccessToken();
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - 24 * 60 * 60;

  const [user, tokens, models, status] = await Promise.all([
    getUser(token),
    listTokens(token).catch(() => [] as GatewayToken[]),
    getUserModels(token).catch(() => [] as string[]),
    getStatus().catch(() => null),
  ]);

  const [performance, uptime, quotaData] = await Promise.all([
    getPerfSummary(token, 24).catch(() => null),
    status?.uptimeKumaEnabled
      ? getUptimeStatus().catch(() => [] as GatewayUptimeGroup[])
      : Promise.resolve([] as GatewayUptimeGroup[]),
    getQuotaDataSelf(token, { start: startSec, end: nowSec }).catch(() => [] as GatewayQuotaPoint[]),
  ]);

  const points = quotaData.length > 0 ? quotaData : await logsAsPoints(token, startSec);
  const usage24hUsd =
    points.reduce((total, point) => total + point.quota, 0) / QUOTA_PER_USD;

  return {
    balanceUsd: user.quota / QUOTA_PER_USD,
    usedUsd: user.usedQuota / QUOTA_PER_USD,
    requestCount: user.requestCount,
    keyCount: tokens.length,
    preferredKey: preferredKeyOf(tokens),
    model: models[0] ?? null,
    endpoint: relayEndpoint(status),
    usage24hUsd,
    usage24hSeries: buildUsageSeries(points, startSec, nowSec),
    status: {
      apiInfoEnabled: status?.apiInfoEnabled ?? false,
      announcementsEnabled: status?.announcementsEnabled ?? false,
      faqEnabled: status?.faqEnabled ?? false,
      uptimeKumaEnabled: status?.uptimeKumaEnabled ?? false,
      apiInfo: status?.apiInfo ?? [],
      announcements: status?.announcements ?? [],
      faq: status?.faq ?? [],
    },
    performance: performance ?? {
      successRate: null,
      avgLatencyMs: null,
      avgTps: null,
      models: [],
    },
    uptime,
  };
}

/* --- model analytics ----------------------------------------------------- */

/**
 * The first paint of the model-analytics page.
 *
 * The server renders the default window — hourly buckets over the last day —
 * and the client swaps in the visitor's saved chart preferences on mount,
 * refetching only when they differ. Rendering the default here avoids a loading
 * flash without pretending the saved preferences are known before hydration.
 */
export async function getQuotaAnalytics(isAdmin: boolean): Promise<QuotaAnalyticsInitial> {
  const granularity: TimeGranularity = "hour";
  const days = TIME_RANGE_BY_GRANULARITY[granularity];
  const { from, to } = computeTimeRange(days);
  const token = await requireAccessToken();
  const items = await getQuotaData(
    token,
    { startTimestamp: from, endTimestamp: to, granularity },
    isAdmin,
  );
  return { items, granularity, days, from, to };
}
