// Model-analytics logic for the /dashboard/models page.
//
// Ported from new-api's dashboard "Model Call Analytics" section
// (web/src/features/dashboard): the stat rollup, the time bucketing, the chart
// preferences and the four series all live here. Nothing in this file touches
// React, the DOM or a chart library, so the server can pre-compute the first
// paint and the client can re-run the same maths after a filter change. The
// rendering lives in components/dashboard/models-charts.

import { QUOTA_PER_USD } from "@/lib/money";

/* ---------- shapes ------------------------------------------------------- */

export type TimeGranularity = "hour" | "day" | "week";
export type ConsumptionChartType = "bar" | "area";
export type ModelChartTab = "trend" | "proportion" | "top";

/** One bucket of `/api/data/self`, summed by the gateway for the time unit. */
export type QuotaDataItem = {
  id?: number;
  user_id?: number;
  username?: string;
  model_name?: string;
  /** Unix seconds, aligned to the bucket the granularity asked for. */
  created_at: number;
  token_used?: number;
  count?: number;
  quota?: number;
};

export type AnalyticsRange = { from: number; to: number };

export type ChartPreferences = {
  consumptionDistributionChart: ConsumptionChartType;
  modelAnalyticsChart: ModelChartTab;
  defaultTimeRangeDays: number;
  defaultTimeGranularity: TimeGranularity;
};

/** What the server hands the page for its first render. */
export type QuotaAnalyticsInitial = {
  items: QuotaDataItem[];
  granularity: TimeGranularity;
  days: number;
  from: number;
  to: number;
};

/** One row of a chart: `time` on the x axis, a column per model. */
export type ChartRow = Record<string, string | number>;

export type ChartSeries = {
  rows: ChartRow[];
  models: string[];
  /** Parallel to `models`; the fill used for each series. */
  colors: string[];
};

export type AnalyticsTotals = { quota: number; count: number; tokens: number };

export type ModelAnalytics = {
  totals: AnalyticsTotals;
  /** Stable fill per model, including the "Other" bucket. */
  colorOf: Record<string, string>;
  /** Every model, stacked (the "bar" consumption view). */
  quotaBar: ChartSeries;
  /** Top models plus an "Other" bucket (the "area" consumption view). */
  quotaArea: ChartSeries;
  /** Call counts over time, top models plus "Other". */
  trend: ChartSeries;
  /** Call-count share per model, largest first. */
  pie: Array<{ name: string; value: number }>;
  /** Call-count ranking, top models plus "Other". */
  rank: Array<{ name: string; value: number }>;
};

/* ---------- constants ---------------------------------------------------- */

export const OTHER_LABEL = "Other";
export const MAX_CHART_TREND_POINTS = 7;
const MAX_AREA_MODELS = 15;
const MAX_TREND_MODELS = 20;
const MAX_RANK_MODELS = 20;

export const TIME_RANGE_PRESETS = [1, 7, 14, 29] as const;

/**
 * Days each granularity opens on, matching new-api: an hourly view is one day,
 * a daily view a week, a weekly view a month.
 */
export const TIME_RANGE_BY_GRANULARITY: Record<TimeGranularity, number> = {
  hour: 1,
  day: 7,
  week: 29,
};

export const DEFAULT_PREFERENCES: ChartPreferences = {
  consumptionDistributionChart: "bar",
  modelAnalyticsChart: "trend",
  defaultTimeRangeDays: 1,
  defaultTimeGranularity: "hour",
};

export const PREFERENCES_STORAGE_KEY = "aigiare.dashboard.modelAnalytics";

/**
 * VChart's built-in data palette — the one new-api's charts draw from. There
 * are two tiers: ten colours up to ten series, twenty beyond that.
 */
const DATA_COLORS_TIER_1 = [
  "#1664FF", "#1AC6FF", "#FF8A00", "#3CC780", "#7442D4",
  "#FFC400", "#304D77", "#B48DEB", "#009488", "#FF7DDA",
];
const DATA_COLORS_TIER_2 = [
  "#1664FF", "#B2CFFF", "#1AC6FF", "#94EFFF", "#FF8A00", "#FFCE7A",
  "#3CC780", "#B9EDCD", "#7442D4", "#DDC5FA", "#FFC400", "#FAE878",
  "#304D77", "#8B959E", "#B48DEB", "#EFE3FF", "#009488", "#59BAA8",
  "#FF7DDA", "#FFCFEE",
];

export function chartColors(domainLength: number): string[] {
  return domainLength <= 10 ? DATA_COLORS_TIER_1 : DATA_COLORS_TIER_2;
}

/* ---------- time --------------------------------------------------------- */

const DAY = 86_400;
const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

/** The granularity a quick range implies, matching new-api's pairing. */
export function granularityForRangeDays(days: number): TimeGranularity {
  if (days <= 1) return "hour";
  if (days >= 29) return "week";
  return "day";
}

/** A rolling window ending now: "1 day" means the last 24 hours. */
export function getRollingRange(days: number, now = new Date()): AnalyticsRange {
  const end = Math.floor(now.getTime() / 1000);
  return { from: end - days * DAY, to: end };
}

/**
 * The window a stats request should ask for.
 *
 * A quick range is `days` back from now with an hour of slack on the end, so
 * the bucket in progress is included; an explicit `from`/`to` (a custom range)
 * wins over both.
 */
export function computeTimeRange(
  days: number,
  from?: number,
  to?: number,
): AnalyticsRange {
  const now = Math.floor(Date.now() / 1000);
  const end = to ?? now + 3600;
  return { from: from ?? end - days * DAY, to: end };
}

/** Formats a bucket timestamp the way the chart's x axis shows it. */
export function formatChartTime(timestamp: number, granularity: TimeGranularity): string {
  const date = new Date(timestamp * 1000);
  let label = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (granularity === "hour") {
    label += ` ${pad(date.getHours())}:00`;
  } else if (granularity === "week") {
    const end = new Date(date.getTime() + 6 * DAY * 1000);
    label += ` - ${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  }
  return label;
}

/** `YYYY-MM-DD` at local midnight, in unix seconds; 0 for an invalid value. */
export function dayStart(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return 0;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
}

/** `YYYY-MM-DD` at local end-of-day, in unix seconds; 0 for an invalid value. */
export function dayEnd(value: string): number {
  const start = dayStart(value);
  return start === 0 ? 0 : start + DAY - 1;
}

/** The `YYYY-MM-DD` a date field should show for a unix timestamp. */
export function toDateInput(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ---------- formatting --------------------------------------------------- */

const INT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatInt(value: number): string {
  return INT_FORMAT.format(Number.isFinite(value) ? value : 0);
}

/** A short form for an axis or a large stat: 12.4K, 3.1M. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}K`;
  return `${sign}${trim(abs)}`;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** A compact dollars label for a chart axis. */
export function usdAxis(value: number): string {
  if (!value) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${formatCompact(value)}`;
  if (abs >= 1) return `$${value.toFixed(value >= 100 ? 0 : 2)}`;
  return `$${value.toFixed(4)}`;
}

/** Division that answers 0 rather than NaN or Infinity, to a fixed precision. */
export function safeDivide(value: number, divisor: number, precision = 3): number {
  const result = value / divisor;
  if (!Number.isFinite(result)) return 0;
  const factor = 10 ** precision;
  return Math.round(result * factor) / factor;
}

/* ---------- aggregation -------------------------------------------------- */

/** A zeroed total, reused as the fold's seed. */
const ZERO: AnalyticsTotals = { quota: 0, count: 0, tokens: 0 };

const addTotals = (a: AnalyticsTotals, b: AnalyticsTotals): AnalyticsTotals => ({
  quota: a.quota + b.quota,
  count: a.count + b.count,
  tokens: a.tokens + b.tokens,
});

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/**
 * Buckets the gateway's rows by time and model, then builds every series the
 * page draws.
 *
 * The gateway already sums within its own time unit, so this is a grouping and
 * ranking pass rather than a log scan: rows collapse onto `formatChartTime`
 * keys, models are ranked per metric, and the three long-tailed views fold
 * their tail into an "Other" series so the legend stays readable.
 */
export function processAnalytics(
  items: QuotaDataItem[],
  granularity: TimeGranularity,
): ModelAnalytics {
  const timeModel = new Map<string, Map<string, AnalyticsTotals>>();
  const modelTotals = new Map<string, AnalyticsTotals>();

  for (const item of items) {
    const time = formatChartTime(Number(item.created_at) || 0, granularity);
    const model = item.model_name || "Unknown";
    const value: AnalyticsTotals = {
      quota: Number(item.quota) || 0,
      count: Number(item.count) || 0,
      tokens: Number(item.token_used) || 0,
    };

    const atTime = timeModel.get(time) ?? new Map<string, AnalyticsTotals>();
    atTime.set(model, addTotals(atTime.get(model) ?? ZERO, value));
    timeModel.set(time, atTime);

    modelTotals.set(model, addTotals(modelTotals.get(model) ?? ZERO, value));
  }

  const models = [...modelTotals.keys()].sort();
  const times = padTimes([...timeModel.keys()].sort(), items, granularity);

  const domain = [...models, OTHER_LABEL];
  const palette = chartColors(domain.length);
  const colorOf: Record<string, string> = {};
  domain.forEach((model, index) => {
    colorOf[model] = palette[index % palette.length];
  });

  const quotaOf = (totals?: AnalyticsTotals) => round4((totals?.quota ?? 0) / QUOTA_PER_USD);
  const countOf = (totals?: AnalyticsTotals) => totals?.count ?? 0;

  const quotaBar: ChartSeries = {
    rows: times.map((time) => {
      const row: ChartRow = { time };
      const atTime = timeModel.get(time);
      for (const model of models) row[model] = quotaOf(atTime?.get(model));
      return row;
    }),
    models,
    colors: models.map((model) => colorOf[model]),
  };

  const quotaArea = capped(
    times,
    modelTotals,
    timeModel,
    quotaOf,
    (totals) => totals?.quota ?? 0,
    MAX_AREA_MODELS,
    colorOf,
  );

  const trend = capped(
    times,
    modelTotals,
    timeModel,
    countOf,
    (totals) => totals?.count ?? 0,
    MAX_TREND_MODELS,
    colorOf,
  );

  const pie = [...modelTotals.entries()]
    .map(([name, totals]) => ({ name, value: totals.count }))
    .sort((a, b) => b.value - a.value);

  const ranked = [...modelTotals.entries()]
    .map(([name, totals]) => ({ name, value: totals.count }))
    .sort((a, b) => b.value - a.value);
  const rank =
    ranked.length > MAX_RANK_MODELS
      ? [
          ...ranked.slice(0, MAX_RANK_MODELS),
          {
            name: OTHER_LABEL,
            value: ranked.slice(MAX_RANK_MODELS).reduce((sum, entry) => sum + entry.value, 0),
          },
        ]
      : ranked;

  const totals = [...modelTotals.values()].reduce(addTotals, ZERO);

  return { totals, colorOf, quotaBar, quotaArea, trend, pie, rank };
}

/**
 * Pads a short series with the buckets that preceded it.
 *
 * A quiet account answers with one or two rows and the chart would be a
 * smear, so the window is filled back to seven points — the same trick
 * new-api uses.
 */
function padTimes(
  times: string[],
  items: QuotaDataItem[],
  granularity: TimeGranularity,
): string[] {
  if (times.length >= MAX_CHART_TREND_POINTS || items.length === 0) return times;

  const interval = granularity === "week" ? 7 * DAY : granularity === "day" ? DAY : 3600;
  const last = Math.max(...items.map((item) => Number(item.created_at) || 0));
  return Array.from({ length: MAX_CHART_TREND_POINTS }, (_, index) =>
    formatChartTime(last - (MAX_CHART_TREND_POINTS - 1 - index) * interval, granularity),
  );
}

/** Builds a series with the top `limit` models and an "Other" tail. */
function capped(
  times: string[],
  modelTotals: Map<string, AnalyticsTotals>,
  timeModel: Map<string, Map<string, AnalyticsTotals>>,
  valueOf: (totals?: AnalyticsTotals) => number,
  rankOf: (totals?: AnalyticsTotals) => number,
  limit: number,
  colorOf: Record<string, string>,
): ChartSeries {
  const ranked = [...modelTotals.entries()].sort((a, b) => rankOf(b[1]) - rankOf(a[1]));
  const top = ranked.slice(0, limit).map(([model]) => model);
  const rest = ranked.slice(limit).map(([model]) => model);
  const models = rest.length > 0 ? [...top, OTHER_LABEL] : top;

  const rows = times.map((time) => {
    const row: ChartRow = { time };
    const atTime = timeModel.get(time);
    for (const model of top) row[model] = valueOf(atTime?.get(model));
    if (rest.length > 0) {
      let sum = 0;
      for (const model of rest) sum += valueOf(atTime?.get(model));
      row[OTHER_LABEL] = round4(sum);
    }
    return row;
  });

  return { rows, models, colors: models.map((model) => colorOf[model]) };
}

/* ---------- preferences -------------------------------------------------- */

function isGranularity(value: unknown): value is TimeGranularity {
  return value === "hour" || value === "day" || value === "week";
}

function isChartType(value: unknown): value is ConsumptionChartType {
  return value === "bar" || value === "area";
}

function isChartTab(value: unknown): value is ModelChartTab {
  return value === "trend" || value === "proportion" || value === "top";
}

function isRangePreset(value: unknown): value is number {
  return TIME_RANGE_PRESETS.includes(value as (typeof TIME_RANGE_PRESETS)[number]);
}

/**
 * The visitor's saved chart defaults.
 *
 * Every field is validated against its allowed set, so a value written by an
 * older release — or a hand-edited localStorage entry — falls back to the
 * default rather than reaching the charts.
 */
export function readPreferences(): ChartPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ChartPreferences>;
    return {
      consumptionDistributionChart: isChartType(parsed.consumptionDistributionChart)
        ? parsed.consumptionDistributionChart
        : DEFAULT_PREFERENCES.consumptionDistributionChart,
      modelAnalyticsChart: isChartTab(parsed.modelAnalyticsChart)
        ? parsed.modelAnalyticsChart
        : DEFAULT_PREFERENCES.modelAnalyticsChart,
      defaultTimeRangeDays: isRangePreset(parsed.defaultTimeRangeDays)
        ? parsed.defaultTimeRangeDays
        : DEFAULT_PREFERENCES.defaultTimeRangeDays,
      defaultTimeGranularity: isGranularity(parsed.defaultTimeGranularity)
        ? parsed.defaultTimeGranularity
        : DEFAULT_PREFERENCES.defaultTimeGranularity,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: ChartPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // A browser refusing storage is not worth failing a render over.
  }
}
