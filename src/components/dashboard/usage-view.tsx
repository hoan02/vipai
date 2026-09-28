"use client";

import { useMemo, useState } from "react";
import { Calendar, KeyRound, Users } from "lucide-react";
import { PageHead, SectionTitle, Stat } from "@/components/dashboard/kit";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { DashboardUsage } from "@/server/dashboard";
import type { UsagePoint } from "@/lib/dashboard-data";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const helpDot = {
  width: 14,
  height: 14,
  border: "1px solid currentColor",
  borderRadius: "50%",
  display: "inline-grid",
  placeItems: "center",
  fontSize: 9.5,
  lineHeight: 1,
  opacity: 0.55,
} as const;

function UsageChart({ series }: { series: UsagePoint[] }) {
  const W = 940;
  const H = 250;
  const padX = 16;
  const padY = 22;
  const max = 70;

  const points = useMemo(() => {
    const n = series.length;
    if (n === 0) return null;

    // A single data point has no horizontal span, so centre it instead of
    // dividing by (n - 1) === 0, which produced NaN coordinates.
    const x = (i: number) => (n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1));
    const y = (v: number) => H - padY - ((Number.isFinite(v) ? v : 0) / max) * (H - 2 * padY);
    const line = (key: "input" | "output") =>
      series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
    const area =
      `M${x(0).toFixed(1)},${y(series[0].input).toFixed(1)} ` +
      series.map((d, i) => `L${x(i).toFixed(1)},${y(d.input).toFixed(1)}`).join(" ") +
      ` L${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} L${x(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;
    return { n, line: { input: line("input"), output: line("output") }, area, x, y };
  }, [series]);

  if (!points) {
    return (
      <div className="empty-row" style={{ padding: "48px 16px", textAlign: "center" }}>
        No usage recorded in this period yet.
      </div>
    );
  }

  return (
    <div className="uchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Token usage by day, last 14 days">
        <defs>
          <linearGradient id="uInput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f97316" stopOpacity="0.32" />
            <stop offset="1" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 20, 40, 60].map((g) => (
          <g key={g}>
            <line
              x1={padX}
              y1={points.y(g).toFixed(1)}
              x2={W - padX}
              y2={points.y(g).toFixed(1)}
              stroke="#14110f"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
            <text x={W - padX} y={points.y(g) - 4} textAnchor="end" fontSize="10" fill="#14110f" fillOpacity="0.38">
              {g}k
            </text>
          </g>
        ))}
        <path d={points.area} fill="url(#uInput)" />
        <path d={points.line.input} fill="none" stroke="#c2410c" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={points.line.output} fill="none" stroke="#222222" strokeWidth="1.6" strokeOpacity="0.7" strokeDasharray="4 4" strokeLinejoin="round" />
        {series.map((d, i) => (
          <text
            key={d.day}
            x={points.x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#14110f"
            fillOpacity="0.4"
          >
            {d.day}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: "#c2410c" }} />
          Input tokens
        </span>
        <span>
          <i style={{ background: "#222222", opacity: 0.7 }} />
          Output tokens
        </span>
        <span className="note">Thousands of tokens</span>
      </div>
    </div>
  );
}

export function UsageView({ usage }: { usage: DashboardUsage }) {
  const { summary, series } = usage;
  // The backend reports totals for the whole account; a per-day window is not
  // available yet, so the range is informational only.
  const [from, setFrom] = useState(() => daysAgo(14));
  const [to, setTo] = useState(() => daysAgo(0));

  return (
    <>
      <PageHead
        title="Usage"
        sub="Track token usage trends and distribution across models, filtered by API key and date range."
      />

      <div className="toolbar" style={{ marginTop: 20 }}>
        <Select
          label="Member"
          value="everyone"
          onChange={() => {}}
          icon={<Users size={16} />}
          options={[{ value: "everyone", label: "Everyone" }]}
        />
        <Select
          label="API key"
          value="all"
          onChange={() => {}}
          icon={<KeyRound size={16} />}
          options={[{ value: "all", label: "All API keys" }]}
        />
        <span className="date-range">
          <DatePicker
            label="From date"
            value={from}
            onChange={setFrom}
            max={to}
            icon={<Calendar size={16} />}
          />
          <span className="note">–</span>
          <DatePicker
            label="To date"
            value={to}
            onChange={setTo}
            min={from}
            icon={<Calendar size={16} />}
          />
        </span>
      </div>

      <div className="stats four" style={{ marginTop: 18 }}>
        <Stat
          label="Input tokens"
          value={summary.input}
        />
        <Stat label="Output tokens" value={summary.output} />
        <Stat
          label={
            <>
              Cache read tokens <span style={helpDot}>?</span>
            </>
          }
          value={summary.cacheRead}
        />
        <Stat
          label={
            <>
              Cache write tokens <span style={helpDot}>?</span>
            </>
          }
          value={summary.cacheWrite}
        />
      </div>

      <SectionTitle hint={`${from} → ${to}`}>Daily usage</SectionTitle>
      <div className="panel" style={{ padding: "14px 12px 8px" }}>
        <UsageChart series={series} />
      </div>
    </>
  );
}
