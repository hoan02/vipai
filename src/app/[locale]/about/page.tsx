import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/seo/json-ld";
import { translatedPageMeta } from "@/lib/seo";
import { breadcrumbs, organizationSchema } from "@/lib/schema";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";

// Translated in both locales, so the canonical is this locale's URL and the two
// are paired with hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("meta");
  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: "/about",
    title: t("aboutTitle"),
    description: t("aboutDescription"),
  });
}

/**
 * The page that answers "who is behind this", which is what an evaluation of
 * trustworthiness looks for. Every claim here is one the product already makes
 * elsewhere (the FAQ, the pricing table, the docs) — nothing is invented for
 * the page.
 */
export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          organizationSchema(),
        ]}
      />

      <section className="section">
        <div className="prose-page">
          <h1>{t("title")}</h1>
          <p className="lede">{t("lede")}</p>

          <h2>{t("whatItDoes")}</h2>
          <p>{t.rich("whatItDoesP1", { code: (chunks) => <code>{chunks}</code> })}</p>
          <p>{t("whatItDoesP2")}</p>

          <h2>{t("pricing")}</h2>
          <p>{t("pricingP1")}</p>
          <p>{t.rich("pricingP2", { link: (chunks) => <Link href="/pricing">{chunks}</Link> })}</p>

          <h2>{t("whereItRuns")}</h2>
          <p>{t("whereItRunsP1")}</p>

          <h2>{t("yourData")}</h2>
          <p>{t.rich("yourDataP1", { link: (chunks) => <Link href="/legal/privacy">{chunks}</Link> })}</p>

          <h2>{t("talkToUs")}</h2>
          <p>
            {t.rich("talkToUsP1", {
              handle: TELEGRAM_HANDLE,
              tg: (chunks) => (
                <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
                  {chunks}
                </a>
              ),
              link: (chunks) => <Link href="/legal/terms">{chunks}</Link>,
            })}
          </p>

          <h2>{t("startUsing")}</h2>
          <ul>
            <li>
              <Link href="/dashboard/api-keys">{t("linkCreateKey")}</Link>
            </li>
            <li>
              <Link href="/docs/quickstart/claude-code">{t("linkClaudeCode")}</Link>
            </li>
            <li>
              <Link href="/docs/api-integration">{t("linkApiRef")}</Link>
            </li>
            <li>
              <Link href="/pricing">{t("linkPrices")}</Link>
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
