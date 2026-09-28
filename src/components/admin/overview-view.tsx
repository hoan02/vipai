import Link from "next/link";
import { PageHead, Stat } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";
import type { AdminStats } from "@/server/admin";

const sections = [
  { href: "/admin/channels", title: "Channels", text: "Upstreams, models, groups, priority and weight." },
  { href: "/admin/pricing", title: "Pricing", text: "What customers pay, per model." },
  { href: "/admin/margin", title: "Margin", text: "Upstream cost and markup; reprice from cost." },
  { href: "/admin/stats", title: "Statistics", text: "Revenue, cost and margin by model." },
  { href: "/admin/redemptions", title: "Redemptions", text: "Credit codes to sell top-ups." },
  { href: "/admin/users", title: "Accounts", text: "Enable, disable and adjust credit." },
  { href: "/admin/models", title: "Models", text: "Descriptions, tags and visibility." },
];

export function OverviewView({
  stats,
  channels,
  models,
}: {
  stats: AdminStats;
  channels: number;
  models: number;
}) {
  return (
    <>
      <PageHead title="Admin" sub="Gateway operations: routing, pricing, margin and accounts." />

      <div className="stats four" style={{ marginTop: 20 }}>
        <Stat label="Channels" value={channels.toLocaleString()} />
        <Stat label="Models" value={models.toLocaleString()} />
        <Stat label="Revenue (recent)" value={usd(stats.revenueUsd)} />
        <Stat label="Margin (recent)" value={usd(stats.marginUsd)} />
      </div>

      <div className="sh">
        <h2>Sections</h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="panel"
            style={{ padding: 18, textDecoration: "none", display: "block" }}
          >
            <b style={{ fontSize: 15 }}>{section.title}</b>
            <p className="note" style={{ marginTop: 6 }}>
              {section.text}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
