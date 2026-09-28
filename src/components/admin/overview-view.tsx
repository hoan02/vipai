import Link from "next/link";
import { PageHead, Stat } from "@/components/dashboard/kit";
import { usd } from "@/lib/money";
import type { AdminStats } from "@/server/admin";

const sections = [
  { href: "/admin/margin", title: "Margin", text: "Upstream cost and markup; reprice from cost." },
  { href: "/admin/stats", title: "Statistics", text: "Revenue, cost and margin by model." },
];

/**
 * The admin landing page.
 *
 * Deliberately thin. The gateway console already owns users, channels, keys,
 * redemptions and pricing, and does all of it better than a reimplementation
 * would. Only the two things it cannot know live here: what we pay upstream,
 * and therefore what the margin is.
 */
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
      <PageHead
        title="Admin"
        sub="The two things the gateway console cannot tell you: upstream cost, and the margin it leaves."
      />

      <div className="stats four" style={{ marginTop: 20 }}>
        <Stat label="Channels" value={channels.toLocaleString()} hint="managed in the console" />
        <Stat label="Models" value={models.toLocaleString()} hint="managed in the console" />
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
        <a
          href="https://api.aigiare.site/console"
          className="panel"
          style={{ padding: 18, textDecoration: "none", display: "block" }}
        >
          <b style={{ fontSize: 15 }}>Gateway console ↗</b>
          <p className="note" style={{ marginTop: 6 }}>
            Users, channels, API keys, redemptions, pricing, logs and settings.
          </p>
        </a>
      </div>
    </>
  );
}
