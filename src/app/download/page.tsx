import type { Metadata } from "next";
import Link from "next/link";
import { LaunchBanner } from "@/components/site/LaunchBanner";
import { Nav } from "@/components/site/Nav";
import { SiteMotion } from "@/components/site/SiteMotion";
import { Footer } from "@/components/site/Sections";
import { DownloadPlatforms } from "@/components/site/download-platforms";
import { Icon } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Download VipAI — VipAI",
  description: "Download the VipAI desktop client for one-click setup with Codex and Claude Code.",
};

const steps = [
  {
    n: "01",
    title: "Install the client",
    body: "Run the installer for your platform. VipAI detects Codex, Claude Code and the other supported clients on your machine.",
  },
  {
    n: "02",
    title: "Sign in once",
    body: "Your account is linked automatically — no keys to paste, no config files to hand-edit.",
  },
  {
    n: "03",
    title: "Start coding",
    body: "VipAI writes the base URL and key into each client. Switch models or protocols later from the dashboard.",
  },
];

export default function DownloadPage() {
  return (
    <>
      <LaunchBanner />
      <Nav />
      <SiteMotion />
      <main>
        <section className="section" data-reveal style={{ paddingTop: "clamp(36px,7vh,72px)" }}>
          <div className="dl-hero">
            <span className="eyebrow">
              <i aria-hidden="true" />
              One-click setup
            </span>
            <h1>Download VipAI</h1>
            <p>
              The desktop client connects Codex, Claude Code and any OpenAI-compatible tool to VipAI for you. One
              install, one sign-in, one bill.
            </p>
          </div>
          <DownloadPlatforms />
        </section>

        <section className="section" data-reveal style={{ paddingTop: 0 }}>
          <div className="sec-head">
            <h2 className="sec-title">How setup works</h2>
            <p className="sec-sub">Three steps, then everything routes through VipAI at the live discount.</p>
          </div>
          <div className="dl-steps">
            {steps.map((s) => (
              <div className="panel dl-step" key={s.n}>
                <span className="n">{s.n}</span>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            ))}
          </div>

          <div className="panel dl-flow" style={{ padding: "20px 22px", marginTop: 20 }}>
            <div>
              <b style={{ fontSize: 15 }}>Prefer to wire it up yourself?</b>
              <p className="meta" style={{ marginTop: 6 }}>
                Point any client at the endpoint below and drop in a key.
              </p>
              <code style={{ display: "block", marginTop: 10 }}>https://api.vipai.site/v1</code>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-primary btn-lg" href="/dashboard/api-keys">
                Get your API key
              </Link>
              <Link className="btn btn-ghost btn-lg" href="/docs/api-integration">
                Read the docs
                <Icon name="ic-arrow" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
