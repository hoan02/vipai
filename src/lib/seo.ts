import type { Metadata } from "next";
import { localePath, routing, type Locale } from "@/i18n/routing";
import { SITE_DOMAIN } from "@/lib/site";

/** Canonical origin of the site. Every absolute URL in metadata comes from here. */
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_NAME = "VipAI";

/** The default title and description, shared by the root layout and the homepage. */
export const SITE_TITLE = "VipAI — The LLM router built for Claude Code and Codex";
export const SITE_DESCRIPTION =
  "VipAI is an AI API gateway for developers: one key for GPT, Claude, Gemini and other leading models.";

/**
 * The share card, a static asset rather than the `opengraph-image` file
 * convention.
 *
 * The convention has to live at `app/` to serve an unprefixed URL, but anything
 * at `app/` is inherited by the generated `_not-found` route, which has no
 * metadataBase to resolve it against — a build warning on every run. A file in
 * `public/` is also one fewer render and caches like any other asset.
 */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "VipAI — one key for every frontier model",
};

/**
 * Open Graph fields shared by every page.
 *
 * Kept in one place because Next.js replaces the whole `openGraph` object when
 * a child segment sets one: a page that wants its own og:title must restate the
 * rest, so it spreads this instead of typing them again. That is also why the
 * image lives here — a page that spread only the type and name would silently
 * drop the card.
 */
export const BASE_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: SITE_NAME,
  locale: "en_US",
  images: [OG_IMAGE],
};

/**
 * Self-canonical plus Open Graph for a single page.
 *
 * Next.js inherits `alternates` and `openGraph` down the segment tree, so a
 * value set once on the root layout would leak onto every child route — every
 * page would claim the homepage as canonical. Each page therefore states its
 * own with this helper.
 *
 * The OG image is deliberately absent: `app/opengraph-image.tsx` is file-based
 * metadata, and file-based metadata overrides the `metadata` object, which is
 * how one generated image serves every route.
 */
export function pageMeta(
  path: string,
  title: string,
  description: string,
  languages?: Record<string, string>,
): Metadata {
  return {
    // `languages` is hreflang: a map of locale (or `x-default`) to the path that
    // locale serves. Only locales that actually have a page belong in it —
    // pointing an alternate at a 404 is worse than declaring none, so an
    // English-only page passes nothing and stays canonical on its own URL.
    alternates: { canonical: path, ...(languages ? { languages } : {}) },
    openGraph: { ...BASE_OPEN_GRAPH, url: path, title, description },
  };
}

/**
 * Metadata for a page whose content exists in every locale, rendered from the
 * locale being served.
 *
 * The canonical is self-referential — it names this locale's URL, not the
 * default one — and `languages` is the reciprocal hreflang map, with
 * `x-default` on the default locale for a visitor whose language matches
 * nothing.
 *
 * Why a function of the locale rather than a shared constant: a static
 * `metadata` export cannot know which locale it is rendering for, so one shared
 * object would make the Vietnamese page declare the English URL as its
 * canonical — and a canonical pointing elsewhere is how a translated page gets
 * dropped from the index even though it is perfectly good.
 *
 * `title` is used as an absolute `<title>` *and* as `og:title`, so it carries
 * the brand itself and the layout's `%s — VipAI` template does not apply. One
 * string per page, in whichever order the language puts it.
 */
export function translatedPageMeta(args: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = localePath(args.locale, args.path);

  const languages: Record<string, string> = {};
  for (const locale of routing.locales) languages[locale] = localePath(locale, args.path);
  languages["x-default"] = localePath(routing.defaultLocale, args.path);

  return {
    title: { absolute: args.title },
    description: args.description,
    alternates: { canonical, languages },
    openGraph: { ...BASE_OPEN_GRAPH, url: canonical, title: args.title, description: args.description },
    // Translated content belongs in the index in this locale too. The layout
    // defaults a non-default locale to noindex, because most of the tree is
    // still English-only; this is the explicit opt-in for the pages that are
    // not.
    robots: { index: true, follow: true },
  };
}
