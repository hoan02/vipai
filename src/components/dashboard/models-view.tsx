"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  BarChart3,
  Calendar,
  Coins,
  Hash,
  Layers,
  PieChart,
  RefreshCw,
  Timer,
  Zap,
} from "lucide-react";
import { PageHead, Stat } from "@/components/dashboard/kit";
import { ModelCallChart, QuotaDistributionChart } from "@/components/dashboard/models-charts";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { usd, QUOTA_PER_USD } from "@/lib/money";
import {
  DEFAULT_PREFERENCES,
  TIME_RANGE_PRESETS,
  dayEnd,
  dayStart,
  formatInt,
  getRollingRange,
  granularityForRangeDays,
  processAnalytics,
  readPreferences,
  safeDivide,
  savePreferences,
  toDateInput,
  type AnalyticsRange,
  type ChartPreferences,
  type ConsumptionChartType,
  type ModelChartTab,
  type QuotaAnalyticsInitial,
  type QuotaDataItem,
  type TimeGranularity,
} from "@/lib/analytics";

const GRANULARITY_OPTIONS = [
  { value: "hour", label: "Hourly" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
];

const MODEL_TABS: Array<{ value: ModelChartTab; label: string }> = [
  { value: "trend", label: "Call trend" },
  { value: "proportion", label: "Call count distribution" },
  { value: "top", label: "Call count ranking" },
];

const rangeLabel = (days: number) => (days === 1 ? "1 day" : `${days} days`);

/**
 * The model-analytics dashboard.
 *
 * Modelled on new-api's `/dashboard/models` section: a stat strip, a quota
 * distribution chart and a tabbed model-call chart, over a time window the
 * visitor picks. The server renders the default window so the first paint has
 * data; the visitor's saved preferences are read on mount and only trigger a
 * refetch when they differ, which keeps the client and server renders
 * identical until hydration finishes.
 */
export function ModelsView({ initial }: { initial: QuotaAnalyticsInitial }) {
  const [prefs, setPrefs] = useState<ChartPreferences>(DEFAULT_PREFERENCES);
  const [granularity, setGranularity] = useState<TimeGranularity>(initial.granularity);
  const [range, setRange] = useState<AnalyticsRange>({ from: initial.from, to: initial.to });
  const [presetDays, setPresetDays] = useState<number | null>(initial.days);
  const [fromDate, setFromDate] = useState(() => toDateInput(initial.from));
  const [toDate, setToDate] = useState(() => toDateInput(initial.to));
  const [chartType, setChartType] = useState<ConsumptionChartType>(
    DEFAULT_PREFERENCES.consumptionDistributionChart,
  );
  const [tab, setTab] = useState<ModelChartTab>(DEFAULT_PREFERENCES.modelAnalyticsChart);
  const [items, setItems] = useState<QuotaDataItem[]>(initial.items);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextGranularity: TimeGranularity, window: AnalyticsRange) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        from: String(window.from),
        to: String(window.to),
        granularity: nextGranularity,
      });
      const response = await fetch(`/api/analytics?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message || "Could not load the analytics.");
        return;
      }
      const payload = (await response.json()) as { items?: QuotaDataItem[] };
      setItems(payload.items ?? []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = useCallback((next: ChartPreferences) => {
    setPrefs(next);
    savePreferences(next);
  }, []);

  // Adopt the visitor's saved preferences. The state above is seeded from the
  // server's defaults, so this must run after mount to keep hydration quiet.
  useEffect(() => {
    const saved = readPreferences();
    setPrefs(saved);
    setChartType(saved.consumptionDistributionChart);
    setTab(saved.modelAnalyticsChart);
    setPresetDays(saved.defaultTimeRangeDays);

    if (
      saved.defaultTimeGranularity !== initial.granularity ||
      saved.defaultTimeRangeDays !== initial.days
    ) {
      const window = getRollingRange(saved.defaultTimeRangeDays);
      setGranularity(saved.defaultTimeGranularity);
      setRange(window);
      setFromDate(toDateInput(window.from));
      setToDate(toDateInput(window.to));
      void load(saved.defaultTimeGranularity, window);
    }
  }, [initial.days, initial.granularity, load]);

  const applyRange = (days: number) => {
    const nextGranularity = granularityForRangeDays(days);
    const window = getRollingRange(days);
    setPresetDays(days);
    setGranularity(nextGranularity);
    setRange(window);
    setFromDate(toDateInput(window.from));
    setToDate(toDateInput(window.to));
    persist({ ...prefs, defaultTimeRangeDays: days, defaultTimeGranularity: nextGranularity });
    void load(nextGranularity, window);
  };

  const applyGranularity = (value: string) => {
    const nextGranularity = value as TimeGranularity;
    setGranularity(nextGranularity);
    persist({ ...prefs, defaultTimeGranularity: nextGranularity });
    void load(nextGranularity, range);
  };

  const applyFrom = (value: string) => {
    setFromDate(value);
    const from = dayStart(value);
    const to = dayEnd(toDate);
    if (from && to > from) {
      setPresetDays(null);
      setRange({ from, to });
      void load(granularity, { from, to });
    }
  };

  const applyTo = (value: string) => {
    setToDate(value);
    const from = dayStart(fromDate);
    const to = dayEnd(value);
    if (from && to > from) {
      setPresetDays(null);
      setRange({ from, to });
      void load(granularity, { from, to });
    }
  };

  const chooseChartType = (value: ConsumptionChartType) => {
    setChartType(value);
    persist({ ...prefs, consumptionDistributionChart: value });
  };

  const chooseTab = (value: ModelChartTab) => {
    setTab(value);
    persist({ ...prefs, modelAnalyticsChart: value });
  };

  const analytics = useMemo(() => processAnalytics(items, granularity), [items, granularity]);
  const totals = analytics.totals;
  const minutes = Math.max(1, (range.to - range.from) / 60);
  const rpm = safeDivide(totals.count, minutes);
  const tpm = safeDivide(totals.tokens, minutes);

  return (
    <>
      <PageHead
        title="Models"
        sub="Token spend and call volume per model, for the window you pick."
        side={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void load(granularity, range)}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="toolbar" style={{ marginTop: 18 }}>
        <div className="an-range" role="group" aria-label="Time range">
          {TIME_RANGE_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              className={`chip${presetDays === days ? " is-on" : ""}`}
              aria-pressed={presetDays === days}
              onClick={() => applyRange(days)}
            >
              {rangeLabel(days)}
            </button>
          ))}
        </div>
        <Select
          label="Time granularity"
          value={granularity}
          onChange={applyGranularity}
          options={GRANULARITY_OPTIONS}
        />
        <span className="date-range">
          <DatePicker
            label="From date"
            value={fromDate}
            onChange={applyFrom}
            max={toDate}
            icon={<Calendar size={16} />}
          />
          <span className="note">–</span>
          <DatePicker
            label="To date"
            value={toDate}
            onChange={applyTo}
            min={fromDate}
            icon={<Calendar size={16} />}
          />
        </span>
      </div>

      <div className="stats five" style={{ marginTop: 18 }}>
        <Stat
          label={
            <>
              <Hash size={14} aria-hidden="true" /> Total count
            </>
          }
          value={formatInt(totals.count)}
        />
        <Stat
          label={
            <>
              <Coins size={14} aria-hidden="true" /> Total quota
            </>
          }
          value={usd(totals.quota / QUOTA_PER_USD)}
        />
        <Stat
          label={
            <>
              <Layers size={14} aria-hidden="true" /> Total tokens
            </>
          }
          value={formatInt(totals.tokens)}
        />
        <Stat
          label={
            <>
              <Timer size={14} aria-hidden="true" /> Average RPM
            </>
          }
          value={rpm.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          hint="Requests per minute"
        />
        <Stat
          label={
            <>
              <Zap size={14} aria-hidden="true" /> Average TPM
            </>
          }
          value={tpm.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          hint="Tokens per minute"
        />
      </div>

      {error ? (
        <div className="panel" style={{ padding: 14, marginTop: 16, color: "#b91c1c" }} role="alert">
          {error}
        </div>
      ) : null}

      <section className="an-card" style={{ marginTop: 20 }}>
        <header className="an-head">
          <div className="t">
            <Coins size={16} aria-hidden="true" />
            Quota distribution
            <span className="sub">Total {usd(totals.quota / QUOTA_PER_USD)}</span>
          </div>
          <div className="an-tabs" role="group" aria-label="Chart type">
            <button
              type="button"
              className={chartType === "bar" ? "is-on" : undefined}
              aria-pressed={chartType === "bar"}
              onClick={() => chooseChartType("bar")}
            >
              <BarChart3 size={14} aria-hidden="true" /> Bar
            </button>
            <button
              type="button"
              className={chartType === "area" ? "is-on" : undefined}
              aria-pressed={chartType === "area"}
              onClick={() => chooseChartType("area")}
            >
              <AreaChart size={14} aria-hidden="true" /> Area
            </button>
          </div>
        </header>
        <div className="an-body">
          {loading ? (
            <div className="an-skeleton" aria-hidden="true" />
          ) : (
            <QuotaDistributionChart
              series={chartType === "area" ? analytics.quotaArea : analytics.quotaBar}
              area={chartType === "area"}
            />
          )}
        </div>
      </section>

      <section className="an-card" style={{ marginTop: 16 }}>
        <header className="an-head">
          <div className="t">
            <PieChart size={16} aria-hidden="true" />
            Model call analytics
            <span className="sub">Total {formatInt(totals.count)} calls</span>
          </div>
          <div className="an-tabs" role="group" aria-label="Chart">
            {MODEL_TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={tab === option.value ? "is-on" : undefined}
                aria-pressed={tab === option.value}
                onClick={() => chooseTab(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>
        <div className="an-body">
          {loading ? (
            <div className="an-skeleton" aria-hidden="true" />
          ) : (
            <ModelCallChart tab={tab} analytics={analytics} />
          )}
        </div>
      </section>
    </>
  );
}
