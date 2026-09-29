import type { ReactNode } from "react";
import type { Metadata } from "next";
import { LaunchBanner } from "@/components/site/LaunchBanner";
import { Nav } from "@/components/site/Nav";
import { SiteMotion } from "@/components/site/SiteMotion";
import { Footer } from "@/components/site/Sections";
import { SvgSprite } from "@/lib/icons";
import { DocsShell } from "@/components/docs/docs-shell";
import "./docs.css";

export const metadata: Metadata = {
  title: {
    default: "Docs — VipAI",
    template: "%s — VipAI Docs",
  },
  description:
    "VipAI documentation: connect Claude Code and other agent tools, call the Anthropic, OpenAI and Gemini compatible API, and understand rate limits and billing.",
};

/**
 * Documentation chrome lives here, once. Each page renders only its prose.
 *
 * <SvgSprite /> is required: the rail renders brand marks through <use href="#ic-…">,
 * and the sprite was previously only mounted on the home page, so every icon in
 * the documentation rail resolved to an empty box.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SvgSprite />
      <LaunchBanner />
      <Nav />
      <SiteMotion />
      <main>
        <DocsShell>{children}</DocsShell>
      </main>
      <Footer />
    </>
  );
}
