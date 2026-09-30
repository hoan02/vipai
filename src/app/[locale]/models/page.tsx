import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicModels } from "@/server/pricing";
import { translatedPageMeta } from "@/lib/seo";
import { breadcrumbs, modelListSchema } from "@/lib/schema";
import { modelSlug, type Model } from "@/lib/data";

/** Static, revalidated every 60s to match the pricing fetch (see `pricing/page.tsx`). */
export const revalidate = 60;

// Translated in both locales, so the canonical is this locale's URL and the two
// are paired with hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    namespace: "meta",
  });
  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: "/models",
    title: t("modelsTitle"),
    description: t("modelsDescription"),
  });
}

function byVendor(models: Model[]): Array<[string, Model[]]> {
  const groups = new Map<string, Model[]>();
  for (const model of models) {
    const list = groups.get(model.vendor);
    if (list) list.push(model);
    else groups.set(model.vendor, [model]);
  }
  return [...groups];
}

/**
 * The crawlable hub for the model pages.
 *
 * `/pricing` shows what each model costs; this lists them as links, so every
 * `/models/<id>` is reachable in one hop from a page in the sitemap.
 */
export default async function ModelsIndexPage() {
  const models = await getPublicModels();
  const t = await getTranslations("catalogue");
  const tc = await getTranslations("common");

  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Models", path: "/models" },
          ]),
          modelListSchema(models),
        ]}
      />

      <section className="section">
        <div className="prose-page">
          <h1>{t("title")}</h1>
          <p className="lede">
            {t.rich("lede", { link: (chunks) => <Link href="/pricing">{chunks}</Link> })}
          </p>

          {byVendor(models).map(([vendor, list]) => (
            <section key={vendor}>
              <h2>{vendor}</h2>
              <ul>
                {list.map((m) => (
                  <li key={m.id}>
                    <Link href={`/models/${modelSlug(m.id)}`}>{m.name}</Link>
                    {" — "}
                    {t("itemLine", { in: m.inNow, out: m.outNow })}
                    {m.ctx ? (
                      <>
                        {" · "}
                        {t("itemContext", { ctx: m.ctx })}
                      </>
                    ) : null}
                    {m.discPct > 0 ? (
                      <>
                        {" · "}
                        {tc("discountOff", { pct: m.discPct })}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {models.length === 0 ? <p>{t("empty")}</p> : null}

          <h2>{t("usingTitle")}</h2>
          <p>
            {t.rich("usingBody", {
              docsModels: (chunks) => <Link href="/docs/models">{chunks}</Link>,
              docsApi: (chunks) => <Link href="/docs/api-integration">{chunks}</Link>,
            })}
          </p>
        </div>
      </section>
    </PageShell>
  );
}
