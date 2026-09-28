"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Copy,
  ExternalLink,
  Flame,
  Gauge,
  HeartPulse,
  HelpCircle,
  Megaphone,
  Route,
  ShieldCheck,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usd } from "@/lib/money";
import type {
  DashboardOverview,
  OverviewPerformance,
  OverviewStatus,
} from "@/server/dashboard";
import type { GatewayAnnouncement, GatewayUptimeGroup } from "@/server/gateway";

/* --------------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------------ */

export type Tone = "ok" | "warn" | "bad" | "muted";

export function formatLatency(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export function formatThroughput(tps: number | null): string {
  if (tps === null || !Number.isFinite(tps) || tps <= 0) return "—";
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}K t/s`;
  return `${tps.toFixed(tps < 10 ? 2 : 1)} t/s`;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

/** Grades a success rate the way the console does: 100/90/70 thresholds. */
export function successTone(rate: number | null): Tone {
  if (rate === null || !Number.isFinite(rate)) return "muted";
  if (rate >= 100) return "ok";
  if (rate >= 90) return "ok";
  if (rate >= 70) return "warn";
  return "bad";
}

function latencyTone(ms: number): Tone {
  if (ms < 200) return "ok";
  if (ms < 500) return "warn";
  return "bad";
}

const API_INFO_COLORS: Record<string, string> = {
  blue: "#2563eb",
  "light-blue": "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#0d9488",
  "light-green": "#65a30d",
  green: "#16a34a",
  lime: "#84cc16",
  yellow: "#eab308",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#dc2626",
  pink: "#ec4899",
  purple: "#9333ea",
  violet: "#7c3aed",
  indigo: "#4f46e5",
  grey: "#6b7280",
  slate: "#475569",
};

function apiInfoColor(color: string): string {
  return API_INFO_COLORS[color] ?? API_INFO_COLORS.blue;
}

const ANNOUNCEMENT_COLORS: Record<string, string> = {
  default: "#6b7280",
  ongoing: "#2563eb",
  success: "#16a34a",
  warning: "#f59e0b",
  error: "#dc2626",
};

function announcementColor(type?: string): string {
  return ANNOUNCEMENT_COLORS[type ?? "default"] ?? ANNOUNCEMENT_COLORS.default;
}

const UPTIME_COLORS: Record<number, string> = {
  1: "#10b981",
  0: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
};

function uptimeColor(status: number): string {
  return UPTIME_COLORS[status] ?? "#9ca3af";
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFmt.format(date);
}

function preview(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  document.body.removeChild(area);
}

/* --------------------------------------------------------------------------
 * Shared panel shell
 * ------------------------------------------------------------------------ */

export function Panel({
  icon,
  title,
  description,
  actions,
  children,
  empty,
  emptyText,
  scroll,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  empty?: boolean;
  emptyText?: string;
  scroll?: boolean;
}) {
  return (
    <section className="panel ov-panel">
      <header className="ov-panel-hd">
        <span className="ov-panel-ico" aria-hidden="true">
          {icon}
        </span>
        <div className="ov-panel-t">
          <h3>{title}</h3>
          {description ? <p className="note">{description}</p> : null}
        </div>
        {actions ? <div className="ov-panel-actions">{actions}</div> : null}
      </header>
      <div className={`ov-panel-bd${scroll ? " is-scroll" : ""}`}>
        {empty ? <p className="ov-empty">{emptyText}</p> : children}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Usage at a glance
 * ------------------------------------------------------------------------ */

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  if (values.length < 2 || max <= 0) return null;

  const W = 120;
  const H = 28;
  const step = W / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = H - 3 - (value / max) * (H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="ov-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function GlanceCard({
  icon,
  label,
  value,
  note,
  spark,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  spark?: number[];
}) {
  return (
    <div className="ov-glance">
      <span className="ov-glance-k">
        {icon}
        {label}
      </span>
      <b className="ov-glance-v">{value}</b>
      {spark && spark.some((v) => v > 0) ? <Sparkline values={spark} /> : null}
      <small className="note">{note}</small>
    </div>
  );
}

function creditHealth(balanceUsd: number, usage24hUsd: number): { tone: Tone; label: string } {
  if (balanceUsd <= 0) return { tone: "bad", label: "Balance depleted" };
  if (usage24hUsd > 0 && balanceUsd / usage24hUsd < 3) {
    return { tone: "warn", label: "Low balance" };
  }
  return { tone: "ok", label: "Healthy" };
}

function runwayLabel(balanceUsd: number, usage24hUsd: number): string {
  if (balanceUsd <= 0) return "Balance depleted";
  if (usage24hUsd <= 0) return "No recent usage";
  const days = balanceUsd / usage24hUsd;
  if (!Number.isFinite(days)) return "No recent usage";
  if (days < 1) return "Less than 1 day left";
  if (days > 999) return "999+ days";
  return `~${Math.floor(days)} days`;
}

export function SummaryCards({ overview }: { overview: DashboardOverview }) {
  const { balanceUsd, usedUsd, requestCount, usage24hUsd, usage24hSeries } = overview;
  const health = creditHealth(balanceUsd, usage24hUsd);
  const runway = runwayLabel(balanceUsd, usage24hUsd);

  return (
    <section className="panel ov-summary">
      <div className="ov-summary-main">
        <div className="ov-summary-hd">
          <h3>Usage at a glance</h3>
          <p className="note">Monitor balance, usage, and request volume</p>
        </div>
        <div className="ov-glances">
          <GlanceCard
            icon={<Flame size={14} />}
            label="Last 24h usage"
            value={usd(usage24hUsd)}
            note="Consumed in the last 24 hours (USD)"
            spark={usage24hSeries}
          />
          <GlanceCard
            icon={<TrendingUp size={14} />}
            label="Historical Usage"
            value={usd(usedUsd)}
            note="Total consumed (USD)"
          />
          <GlanceCard
            icon={<Activity size={14} />}
            label="Number of requests"
            value={requestCount.toLocaleString()}
            note="Total requests made"
          />
        </div>
      </div>

      <div className="ov-credit">
        <div className="ov-credit-hd">
          <span className="note">Credit remaining</span>
          <span className={`ov-health ov-${health.tone}`}>
            <i aria-hidden="true" />
            {health.label}
          </span>
        </div>
        <div className="ov-credit-amt">{usd(balanceUsd)}</div>
        <div className="ov-credit-grid">
          <div>
            <span className="ov-credit-k">
              <Flame size={12} /> Last 24h usage
            </span>
            <b>{usd(usage24hUsd)}</b>
          </div>
          <div>
            <span className="ov-credit-k">
              <ShieldCheck size={12} /> Runway
            </span>
            <b className={health.tone === "bad" ? "ov-bad" : health.tone === "warn" ? "ov-warn" : undefined}>
              {runway}
            </b>
          </div>
        </div>
        <Link className="btn btn-primary ov-wallet-btn" href="/dashboard/wallet">
          Wallet
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Performance health
 * ------------------------------------------------------------------------ */

function MetricCell({ icon, label, value, tone = "muted" }: { icon: ReactNode; label: string; value: string; tone?: Tone }) {
  return (
    <div className="ov-metric">
      <span className="ov-metric-k">
        {icon}
        {label}
      </span>
      <b className={`ov-${tone}`}>{value}</b>
    </div>
  );
}

export function PerformancePanel({ performance }: { performance: OverviewPerformance }) {
  const hasData = performance.models.length > 0 || performance.successRate !== null;
  const topModels = performance.models.slice(0, 6);

  return (
    <Panel
      icon={<HeartPulse size={16} />}
      title="Performance health"
      description="Performance metrics for the last 24 hours"
      empty={!hasData}
      emptyText="No performance data recorded in the last 24 hours."
    >
      <div className="ov-metrics">
        <MetricCell
          icon={<HeartPulse size={13} />}
          label="Success rate"
          value={formatPercent(performance.successRate)}
          tone={successTone(performance.successRate)}
        />
        <MetricCell icon={<Timer size={13} />} label="Average latency" value={formatLatency(performance.avgLatencyMs)} />
        <MetricCell icon={<Gauge size={13} />} label="Throughput" value={formatThroughput(performance.avgTps)} />
      </div>

      {topModels.length > 0 ? (
        <div className="ov-topmodels">
          <span className="note">Top models by traffic</span>
          <div className="ov-topmodels-grid">
            {topModels.map((model) => (
              <div key={model.modelName} className="ov-topmodel">
                <span className="ov-topmodel-name" title={model.modelName}>
                  {model.modelName}
                </span>
                <span className={`ov-topmodel-rate ov-${successTone(model.successRate)}`}>
                  <i aria-hidden="true" />
                  {formatPercent(model.successRate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * API info
 * ------------------------------------------------------------------------ */

type PingState = { testing: boolean; latency: number | null; error: boolean };

export function ApiInfoPanel({ status }: { status: OverviewStatus }) {
  const [ping, setPing] = useState<Record<string, PingState>>({});
  const items = status.apiInfo;

  const test = async (url: string) => {
    setPing((prev) => ({ ...prev, [url]: { testing: true, latency: null, error: false } }));
    try {
      const start = performance.now();
      await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-cache" });
      const latency = Math.round(performance.now() - start);
      setPing((prev) => ({ ...prev, [url]: { testing: false, latency, error: false } }));
    } catch {
      setPing((prev) => ({ ...prev, [url]: { testing: false, latency: null, error: true } }));
    }
  };

  return (
    <Panel
      icon={<Route size={16} />}
      title="API Info"
      description="Configured routes and latency checks"
      empty={items.length === 0}
      emptyText="No API routes configured"
      scroll
    >
      <ul className="ov-list">
        {items.map((item, index) => {
          const state = ping[item.url];
          return (
            <li key={`${item.route}-${index}`} className="ov-list-item">
              <span className="ov-dot" style={{ background: apiInfoColor(item.color) }} aria-hidden="true" />
              <div className="ov-list-main">
                <span className="ov-list-title">
                  <b>{item.route}</b>
                  {item.description ? <small>{item.description}</small> : null}
                </span>
                <span className="ov-list-url">{item.url}</span>
              </div>
              <div className="ov-list-actions">
                {state?.testing ? <span className="ov-badge ov-warn">Testing…</span> : null}
                {state && !state.testing && state.latency !== null ? (
                  <span className={`ov-badge ov-${latencyTone(state.latency)}`}>{state.latency}ms</span>
                ) : null}
                {state?.error ? <span className="ov-badge">N/A</span> : null}
                <button
                  className="ov-iconbtn"
                  type="button"
                  title="Test latency"
                  aria-label="Test latency"
                  disabled={state?.testing}
                  onClick={() => void test(item.url)}
                >
                  <Zap size={14} />
                </button>
                <button
                  className="ov-iconbtn"
                  type="button"
                  title="Copy URL"
                  aria-label="Copy URL"
                  onClick={() => copyText(item.url)}
                >
                  <Copy size={14} />
                </button>
                <a
                  className="ov-iconbtn"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in new tab"
                  aria-label="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Announcements
 * ------------------------------------------------------------------------ */

function AnnouncementDialog({ item, onClose }: { item: GatewayAnnouncement; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="ov-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Announcement details"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ov-modal">
        <header className="ov-modal-hd">
          <b>Announcement details</b>
          <button className="ov-iconbtn" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {item.publishDate ? <p className="note">Published: {formatDate(item.publishDate)}</p> : null}
        <div className="ov-modal-bd">
          <p className="ov-modal-content">{item.content}</p>
          {item.extra ? <p className="note ov-modal-content">{item.extra}</p> : null}
        </div>
        <div className="ov-modal-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              copyText(item.content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementsPanel({ status }: { status: OverviewStatus }) {
  const [selected, setSelected] = useState<GatewayAnnouncement | null>(null);
  const items = status.announcements;

  return (
    <>
      <Panel
        icon={<Megaphone size={16} />}
        title="Announcements"
        description="Latest platform updates and notices"
        empty={items.length === 0}
        emptyText="No announcements at this time"
        scroll
      >
        <ul className="ov-ann-list">
          {items.map((item, index) => (
            <li key={item.id ?? index}>
              <button type="button" className="ov-ann" onClick={() => setSelected(item)}>
                <span className="ov-dot" style={{ background: announcementColor(item.type) }} aria-hidden="true" />
                <span className="ov-ann-main">
                  <span className="ov-ann-text">{preview(item.content)}</span>
                  {item.publishDate ? <time className="note">{formatDate(item.publishDate)}</time> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      {selected ? <AnnouncementDialog item={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * FAQ
 * ------------------------------------------------------------------------ */

export function FaqPanel({ status }: { status: OverviewStatus }) {
  const items = status.faq;

  return (
    <Panel
      icon={<HelpCircle size={16} />}
      title="FAQ"
      description="Answers for common access and billing questions"
      empty={items.length === 0}
      emptyText="No FAQ entries available"
      scroll
    >
      <div className="ov-faq">
        {items.map((item, index) => (
          <details key={item.id ?? index} className="ov-faq-item">
            <summary>{item.question}</summary>
            <div className="ov-faq-answer">{item.answer}</div>
          </details>
        ))}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Uptime
 * ------------------------------------------------------------------------ */

export function UptimePanel({ uptime }: { uptime: GatewayUptimeGroup[] }) {
  return (
    <Panel
      icon={<Activity size={16} />}
      title="Uptime"
      description="Grouped monitor status from Uptime Kuma"
      empty={uptime.length === 0}
      emptyText="No uptime monitoring configured"
      scroll
    >
      <div className="ov-uptime">
        {uptime.map((group) => (
          <div key={group.categoryName}>
            <div className="ov-uptime-cat">
              <b>{group.categoryName}</b>
              <span className="note">{group.monitors.length}</span>
            </div>
            {group.monitors.map((monitor) => (
              <div key={`${group.categoryName}-${monitor.name}`} className="ov-uptime-row">
                <span className="ov-dot" style={{ background: uptimeColor(monitor.status) }} aria-hidden="true" />
                <span className="ov-uptime-name">
                  {monitor.name}
                  {monitor.group ? <small> ({monitor.group})</small> : null}
                </span>
                <b className="ov-uptime-pct">{(monitor.uptime * 100).toFixed(2)}%</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
