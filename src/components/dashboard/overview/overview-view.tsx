"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  RadioTower,
  ShieldCheck,
  TerminalSquare,
  Timer,
} from "lucide-react";
import { PageHead } from "@/components/dashboard/kit";
import { usePrefsStore } from "@/lib/prefs-store";
import type { DashboardOverview } from "@/server/dashboard";
import {
  AnnouncementsPanel,
  ApiInfoPanel,
  FaqPanel,
  PerformancePanel,
  SummaryCards,
  UptimePanel,
} from "./overview-panels";

type Step = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  completed: boolean;
};

type QuickAction = { title: string; description: string; href: string; icon: ReactNode; adminOnly?: boolean };

/** Masks a key for the preview, keeping the ends readable. */
function formatDisplayKey(key: string): string {
  if (!key) return "sk-...";
  if (key.length <= 14) return key;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function buildCurl(endpoint: string, apiKey: string, model: string): string {
  return [
    `curl ${endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${apiKey}" \\`,
    `  -d '{"model":"${model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join("\n");
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

function StepItem({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  return (
    <li className="ov-step">
      <span className={`ov-step-mark${step.completed ? " is-done" : ""}`} aria-hidden="true">
        {step.completed ? <Check size={15} /> : <Circle size={15} />}
      </span>
      {!isLast ? <span className="ov-step-line" aria-hidden="true" /> : null}
      <Link className="ov-step-card" href={step.href}>
        <span className="ov-step-icon" aria-hidden="true">
          {step.icon}
        </span>
        <span className="ov-step-text">
          <span className="ov-step-title">
            <em>{index + 1}.</em> {step.title}
          </span>
          <span className="note">{step.description}</span>
        </span>
        <ArrowRight size={15} className="ov-step-arrow" aria-hidden="true" />
      </Link>
    </li>
  );
}

function RequestPreview({ overview }: { overview: DashboardOverview }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const model = overview.model ?? "gpt-4o-mini";
  const key = overview.preferredKey;
  const displayKey = key ? formatDisplayKey(key.masked) : "sk-...";
  const preview = buildCurl(overview.endpoint, displayKey, model).split("\n");

  const signals = [
    { label: "Route active", value: "Online", icon: <RadioTower size={13} /> },
    {
      label: "Auth configured",
      value: key ? "Secured" : "Needs API key",
      icon: <ShieldCheck size={13} />,
    },
    { label: "Model selected", value: overview.model ?? "—", icon: <Timer size={13} /> },
  ];

  const copyReal = async () => {
    if (!key || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/keys/${encodeURIComponent(key.id)}/key`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { key?: string } | null;
      if (!response.ok || !payload?.key) throw new Error("reveal failed");
      copyText(buildCurl(overview.endpoint, payload.key, model));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // The preview still shows a masked key, so a failed reveal is not fatal.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ov-preview">
      <div className="ov-preview-hd">
        <span className="ov-preview-ico" aria-hidden="true">
          <TerminalSquare size={15} />
        </span>
        <div className="ov-preview-t">
          <b>First API request</b>
          <small className="note">
            {key ? key.name : "Create an API key to unlock the real request"}
          </small>
        </div>
        {key ? (
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={copyReal}>
            <Copy size={14} />
            {busy ? "Loading…" : copied ? "Copied" : "Copy"}
          </button>
        ) : (
          <Link className="btn btn-ghost btn-sm" href="/dashboard/api-keys">
            Create API key
          </Link>
        )}
      </div>

      <div className="ov-terminal">
        <span className="ov-terminal-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <code>
          {preview.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </code>
      </div>

      <div className="ov-signals">
        {signals.map((signal) => (
          <div key={signal.label} className="ov-signal">
            <span className="ov-signal-k">
              {signal.icon}
              {signal.label}
            </span>
            <span className="ov-signal-v">{signal.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupGuide({ overview, onHide }: { overview: DashboardOverview; onHide: () => void }) {
  const steps = useMemo<Step[]>(
    () => [
      {
        key: "key",
        title: "Create API key",
        description: "Create a key for your app or service",
        href: "/dashboard/api-keys",
        icon: <KeyRound size={14} />,
        completed: overview.keyCount > 0,
      },
      {
        key: "credit",
        title: "Add credits",
        description: "Keep enough balance before production traffic",
        href: "/dashboard/wallet",
        icon: <CreditCard size={14} />,
        completed: overview.balanceUsd > 0 || overview.usedUsd > 0,
      },
      {
        key: "request",
        title: "Send a request",
        description: "Verify routing with Playground or your client",
        href: "/dashboard/playground",
        icon: <TerminalSquare size={14} />,
        completed: overview.requestCount > 0,
      },
    ],
    [overview],
  );

  const actions: QuickAction[] = [
    {
      title: "API Keys",
      description: "Create a key for your app or service",
      href: "/dashboard/api-keys",
      icon: <KeyRound size={15} />,
    },
    {
      title: "Usage Logs",
      description: "Inspect requests, errors, and billing details",
      href: "/dashboard/usage-logs",
      icon: <FileText size={15} />,
    },
    {
      title: "Wallet",
      description: "Top up and review credit history",
      href: "/dashboard/wallet",
      icon: <CreditCard size={15} />,
    },
    {
      title: "API docs",
      description: "Endpoints, SDKs, and protocol details",
      href: "/docs",
      icon: <BookOpen size={15} />,
    },
  ];

  return (
    <div className="ov-setup">
      <section className="panel ov-setup-main">
        <div className="ov-setup-hd">
          <div>
            <span className="ov-eyebrow">
              <ListChecks size={14} /> Get started
            </span>
            <h2>Build on your API gateway in minutes</h2>
            <p className="note">A focused home for keys, balance, routing and service health.</p>
          </div>
          <div className="ov-setup-btns">
            <button className="btn btn-ghost btn-sm" type="button" onClick={onHide}>
              <ChevronUp size={15} /> Hide setup guide
            </button>
            <Link className="btn btn-primary btn-sm" href="/dashboard/api-keys">
              <KeyRound size={15} /> Create API key
            </Link>
          </div>
        </div>

        <div className="ov-setup-grid">
          <ol className="ov-steps">
            {steps.map((step, index) => (
              <StepItem key={step.key} step={step} index={index} isLast={index === steps.length - 1} />
            ))}
          </ol>
          <RequestPreview overview={overview} />
        </div>
      </section>

      <section className="panel ov-setup-side">
        <span className="ov-eyebrow">Recommended actions</span>
        <h3>Keep the platform ready</h3>
        <div className="ov-actions">
          {actions.map((action) => (
            <Link key={action.title} className="ov-action" href={action.href}>
              <span className="ov-action-ico" aria-hidden="true">
                {action.icon}
              </span>
              <span className="ov-action-text">
                <b>{action.title}</b>
                <small className="note">{action.description}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OverviewView({
  overview,
  isAdmin,
}: {
  overview: DashboardOverview;
  isAdmin: boolean;
}) {
  const expanded = usePrefsStore((state) => state.setupGuideExpanded);
  const setSetupGuideExpanded = usePrefsStore((state) => state.setSetupGuideExpanded);

  // Hydrate the persisted preference after mount so server and client agree.
  useEffect(() => {
    void usePrefsStore.persist.rehydrate();
  }, []);

  const steps = [
    overview.keyCount > 0,
    overview.balanceUsd > 0 || overview.usedUsd > 0,
    overview.requestCount > 0,
  ];
  const completed = steps.filter(Boolean).length;
  const complete = completed === steps.length;
  const open = expanded ?? !complete;

  const setGuideOpen = (next: boolean) => {
    setSetupGuideExpanded(next);
  };

  return (
    <>
      <PageHead
        title="Overview"
        sub="Your keys, balance, routing and service health in one place."
        side={
          complete ? (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              aria-expanded={open}
              onClick={() => setGuideOpen(!open)}
            >
              Setup guide
            </button>
          ) : undefined
        }
      />

      <div className="stack-16" style={{ marginTop: 20 }}>
        {open ? (
          <SetupGuide overview={overview} onHide={() => setGuideOpen(false)} />
        ) : (
          <section className="panel ov-setup-bar">
            <span className="ov-step-mark is-done" aria-hidden="true">
              <Check size={15} />
            </span>
            <div className="ov-setup-bar-text">
              <div className="ov-setup-bar-title">
                <b>Setup guide</b>
                <span className="ov-badge">
                  Setup progress: {completed}/{steps.length}
                </span>
              </div>
              <p className="note">Setup guide is collapsed. Expand it anytime.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setGuideOpen(true)}>
              <ChevronDown size={15} /> Show setup guide
            </button>
          </section>
        )}

        <SummaryCards overview={overview} />

        <div className="ov-grid">
          <div className="ov-grid-main">
            <PerformancePanel performance={overview.performance} />

            {overview.status.apiInfoEnabled ||
            overview.status.announcementsEnabled ||
            overview.status.faqEnabled ? (
              <div className="ov-cards2">
                {overview.status.apiInfoEnabled ? <ApiInfoPanel status={overview.status} /> : null}
                {overview.status.announcementsEnabled ? (
                  <AnnouncementsPanel status={overview.status} />
                ) : null}
                {overview.status.faqEnabled ? <FaqPanel status={overview.status} /> : null}
              </div>
            ) : null}

            {isAdmin ? (
              <Link className="panel ov-admin-link" href="/admin">
                <span className="ov-action-ico" aria-hidden="true">
                  <LayoutDashboard size={15} />
                </span>
                <span>
                  <b>Admin</b>
                  <small className="note"> Upstream cost, margin and revenue rollup.</small>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          {overview.status.uptimeKumaEnabled ? (
            <aside className="ov-grid-side">
              <UptimePanel uptime={overview.uptime} />
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
