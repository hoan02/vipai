import type { MetadataRoute } from "next";
import { localePath, routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { LIVE_PAGES } from "@/lib/docs-manifest";
import { getPublicModels } from "@/server/pricing";
import { modelSlug } from "@/lib/data";

/**
 * The indexable surface.
 *
 * Docs come from the manifest, so a page added there lands here without a second
 * edit. Dashboard, admin and API routes are excluded here and disallowed in
 * `robots.ts`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  /**
   * A page that exists in every locale: one entry per locale, each carrying the
   * reciprocal hreflang set. `translatedPageMeta()` writes the same map into the
   * page's `<head>`, and the two must agree — a sitemap that pairs two URLs the
   * head does not pair is a contradiction a crawler has to resolve.
   *
   * Nothing English-only goes through this: `/vi/legal/*` answers noindex, and
   * listing a noindex URL is worse than omitting it.
   */
  function translated(
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) languages[locale] = `${SITE_URL}${localePath(locale, path)}`;
    languages["x-default"] = `${SITE_URL}${localePath(routing.defaultLocale, path)}`;

    return routing.locales.map((locale) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  }

  const core: MetadataRoute.Sitemap = [
    ...translated("/", 1, "daily"),
    ...translated("/pricing", 0.9, "daily"),
    ...translated("/models", 0.8, "daily"),
    ...translated("/download", 0.7, "monthly"),
    ...translated("/about", 0.6, "monthly"),
    // Not translated yet: English only, so a single entry and no hreflang.
    { url: `${SITE_URL}/legal/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];

  const docs: MetadataRoute.Sitemap = LIVE_PAGES.map((page) => ({
    url: `${SITE_URL}${page.href}`,
    lastModified,
    changeFrequency: "weekly",
    priority: page.href === "/docs" ? 0.9 : 0.7,
  }));

  const models: MetadataRoute.Sitemap = (await getPublicModels()).flatMap((model) =>
    translated(`/models/${modelSlug(model.id)}`, 0.6, "weekly"),
  );

  return [...core, ...docs, ...models];
}
