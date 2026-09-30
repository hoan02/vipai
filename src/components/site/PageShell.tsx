import type { ReactNode } from "react";
import { SvgSprite } from "@/lib/icons";
import { LaunchBanner } from "@/components/site/LaunchBanner";
import { Nav } from "@/components/site/Nav";
import { SiteMotion } from "@/components/site/SiteMotion";
import { Footer } from "@/components/site/Sections";

/**
 * The marketing chrome around a plain-content page (about, legal, pricing).
 *
 * The docs and dashboard have their own shells; this is for pages that are just
 * nav + prose + footer, so they do not each repeat the five components. The
 * sprite is mounted here: pages that render icons through `<use href="#…">`
 * need it, and a standalone page used to render empty boxes without it.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SvgSprite />
      <LaunchBanner />
      <Nav />
      <SiteMotion />
      <main>{children}</main>
      <Footer />
    </>
  );
}
