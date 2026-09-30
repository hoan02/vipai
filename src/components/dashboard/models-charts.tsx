"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usd } from "@/lib/money";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { ModelIcon } from "@/components/model-icon";
import {
  formatCompact,
  formatInt,
  usdAxis,
  type ChartSeries,
  type ModelAnalytics,
  type ModelChartTab,
} from "@/lib/analytics";

/**
 * The Recharts renderers behind the models analytics page.
 *
 * The series themselves are built in `@/lib/analytics`; this file only draws
 * them, so the two halves can be reasoned about apart. It is a client module
 * because Recharts measures its container in the browser.
 */

const LEGEND_STYLE = { fontSize: 12, paddingTop: 6 } as const;
const FALLBACK_COLOR = "#8B959E";
const MAX_TOOLTIP_ITEMS = 15;

/**
 * Grid and axis colours for the charts.
 *
 * Recharts writes SVG attributes from JavaScript, so it cannot read the CSS
 * tokens that drive the rest of the theme; the resolved theme decides the
 * values here instead. The light values match what the page used before dark
 * mode existed.
 */
function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    grid: dark ? "rgba(243,238,232,0.12)" : "rgba(20,17,15,0.08)",
    tick: {
      fontSize: 11,
      fill: dark ? "rgba(243,238,232,0.58)" : "rgba(20,17,15,0.45)",
    },
  };
}

type TipKind = "quota" | "count";

type TipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

type TipProps = {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  kind?: TipKind;
};

/**
 * A tooltip that leads with the window's total.
 *
 * new-api's charts sort the hovered models largest-first and pin a total on
 * top; this keeps that, and for a stacked bar the total is the column's whole
 * height rather than the hovered segment.
 */
function AnalyticsTooltip({ active, payload, label, kind = "quota" }: TipProps) {
  const t = useTranslations("models");
  if (!active || !payload || payload.length === 0) return null;

  const rows = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const total = rows.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
  const format = (value: number) => (kind === "quota" ? usd(value) : formatInt(value));

  return (
    <div className="an-tip">
      <div className="an-tip-h">{label}</div>
      <div className="an-tip-row is-total">
        <span className="an-tip-n">{t("total")}</span>
        <b>{format(total)}</b>
      </div>
      {rows.slice(0, MAX_TOOLTIP_ITEMS).map((entry, index) => {
        const seriesName = (entry.payload?.name as string | undefined) ?? entry.name;
        return (
          <div className="an-tip-row" key={String(entry.dataKey ?? seriesName ?? index)}>
            <i style={{ background: entry.color }} aria-hidden="true" />
            <span className="an-tip-n">
              <ModelIcon model={String(seriesName ?? "")} size={13} />
              <span className="an-tip-name">{String(seriesName ?? "")}</span>
            </span>
            <b>{format(Number(entry.value) || 0)}</b>
          </div>
        );
      })}
    </div>
  );
}

function ChartEmpty() {
  const t = useTranslations("models");
  return <div className="an-empty">{t("empty")}</div>;
}

/** The stacked bars or stacked-area lines behind "Quota distribution". */
export function QuotaDistributionChart({
  series,
  area,
}: {
  series: ChartSeries;
  area: boolean;
}) {
  const { rows, models, colors } = series;
  const { grid: GRID, tick: AXIS_TICK } = useChartColors();
  if (rows.length === 0 || models.length === 0) return <ChartEmpty />;

  const axes = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey="time"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={{ stroke: GRID }}
        minTickGap={24}
      />
      <YAxis
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={64}
        tickFormatter={(value: number) => usdAxis(value)}
      />
      <Tooltip content={<AnalyticsTooltip kind="quota" />} />
      <Legend wrapperStyle={LEGEND_STYLE} iconType="square" iconSize={9} />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {area ? (
        <AreaChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 4 }}>
          {axes}
          {models.map((model, index) => (
            <Area
              key={model}
              type="monotone"
              dataKey={model}
              name={model}
              stroke={colors[index]}
              fill={colors[index]}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 4 }}>
          {axes}
          {models.map((model, index) => (
            <Bar key={model} dataKey={model} name={model} stackId="quota" fill={colors[index]} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

function renderPieLabel(props: { name?: string | number; percent?: number }): string {
  const percent = props.percent ?? 0;
  return percent >= 0.05 ? `${props.name} ${Math.round(percent * 100)}%` : "";
}

function ProportionChart({ analytics }: { analytics: ModelAnalytics }) {
  const { pie, colorOf } = analytics;
  if (pie.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <Tooltip content={<AnalyticsTooltip kind="count" />} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="square" iconSize={9} />
        <Pie
          data={pie}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="45%"
          outerRadius="78%"
          paddingAngle={1}
          label={renderPieLabel}
          labelLine={false}
        >
          {pie.map((entry) => (
            <Cell key={entry.name} fill={colorOf[entry.name] ?? FALLBACK_COLOR} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function RankChart({ analytics }: { analytics: ModelAnalytics }) {
  const t = useTranslations("models");
  const { rank, colorOf } = analytics;
  const { grid: GRID, tick: AXIS_TICK } = useChartColors();
  if (rank.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rank} margin={{ top: 8, right: 18, bottom: 52, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={64}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <Tooltip content={<AnalyticsTooltip kind="count" />} />
        <Bar dataKey="value" name={t("calls")}>
          {rank.map((entry) => (
            <Cell key={entry.name} fill={colorOf[entry.name] ?? FALLBACK_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ analytics }: { analytics: ModelAnalytics }) {
  const { rows, models, colors } = analytics.trend;
  const { grid: GRID, tick: AXIS_TICK } = useChartColors();
  if (rows.length === 0 || models.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="time"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <Tooltip content={<AnalyticsTooltip kind="count" />} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="square" iconSize={9} />
        {models.map((model, index) => (
          <Area
            key={model}
            type="monotone"
            dataKey={model}
            name={model}
            stroke={colors[index]}
            fill={colors[index]}
            fillOpacity={0.08}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** The tabbed "Model call analytics" chart: trend, share, or ranking. */
export function ModelCallChart({
  tab,
  analytics,
}: {
  tab: ModelChartTab;
  analytics: ModelAnalytics;
}) {
  if (tab === "proportion") return <ProportionChart analytics={analytics} />;
  if (tab === "top") return <RankChart analytics={analytics} />;
  return <TrendChart analytics={analytics} />;
}
