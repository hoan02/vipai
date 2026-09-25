"use client";

import { useMemo, useState } from "react";
import { Calendar, KeyRound, Users } from "lucide-react";
import { PageHead, Pill, SectionTitle, Stat } from "@/components/dashboard/kit";
import { usageSeries, usageSummary } from "@/lib/dashboard-data";

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

function UsageChart({ series }: { series: typeof usageSeries }) {
  const W = 940;
  const H = 250;
  const padX = 16;
  const padY = 22;
  const max = 70;

  const points = useMemo(() => {
    const n = series.length;
    const x = (i: number) => padX + (i * (W - 2 * padX)) / (n - 1);
    const y = (v: number) => H - padY - (v / max) * (H - 2 * padY);
    const line = (key: "input" | "output") =>
      series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
    const area =
      `M${x(0).toFixed(1)},${y(series[0].input).toFixed(1)} ` +
      series.map((d, i) => `L${x(i).toFixed(1)},${y(d.input).toFixed(1)}`).join(" ") +
      ` L${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} L${x(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;
    return { n, line: { input: line("input"), output: line("output") }, area, x, y };
  }, [series]);

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
        <span className="note">Sep 12 – Sep 25 · thousands of tokens</span>
      </div>
    </div>
  );
}

export function UsageView({
  usage,
}: {
  usage?: { summary: typeof usageSummary; series: typeof usageSeries };
}) {
  const summary = usage?.summary ?? usageSummary;
  const series = usage?.series ?? usageSeries;
  const [from, setFrom] = useState("2026-09-12");
  const [to, setTo] = useState("2026-09-25");

  return (
    <>
      <PageHead
        title="Usage"
        sub="Track token usage trends and distribution across models, filtered by API key and date range."
        side={<Pill tone="role">Sample data</Pill>}
      />

      <div className="toolbar" style={{ marginTop: 20 }}>
        <span className="field-wrap">
          <Users size={16} />
          <select className="field has-icon" defaultValue="everyone" aria-label="Member">
            <option value="everyone">Everyone</option>
            <option value="me">hoanvipboi1@gmail.com</option>
          </select>
        </span>
        <span className="field-wrap">
          <KeyRound size={16} />
          <select className="field has-icon" defaultValue="all" aria-label="API key">
            <option value="all">All API keys</option>
            <option value="prod">Production</option>
            <option value="dev">Local dev</option>
          </select>
        </span>
        <span className="date-range">
          <span className="field-wrap">
            <Calendar size={16} />
            <input className="field has-icon" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          </span>
          <span className="note">–</span>
          <span className="field-wrap">
            <Calendar size={16} />
            <input className="field has-icon" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </span>
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
