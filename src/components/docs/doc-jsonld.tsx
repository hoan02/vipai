import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbs, techArticle } from "@/lib/schema";
import { docBySlug, docCrumbs } from "@/lib/docs-manifest";

/**
 * Structured data for one documentation page.
 *
 * Both blocks are derived from the manifest rather than typed at the call site:
 * the breadcrumb is the same trail the rail and crumbs already show, and the
 * summary is the one-liner the search results use. Adding a docs page therefore
 * needs no change here.
 */
export function DocJsonLd({ slug }: { slug: string }) {
  const page = docBySlug(slug);
  if (!page) return null;

  const trail = docCrumbs(page).map((crumb) => ({
    name: crumb.title,
    path: crumb.href ?? page.href,
  }));

  return (
    <JsonLd
      data={[
        techArticle({ title: page.title, description: page.summary, path: page.href }),
        breadcrumbs(trail),
      ]}
    />
  );
}
