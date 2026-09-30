import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { PageShell } from "@/components/site/PageShell";
import { DownloadPlatforms } from "@/components/site/download-platforms";
import { Icon } from "@/lib/icons";
import { translatedPageMeta } from "@/lib/seo";

// Translated in both locales, so the canonical is this locale's URL and the two
// are paired with hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Explicit locale keeps the route static; a bare `getTranslations()` reads the
  // request locale, which opts the page into dynamic rendering.
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    namespace: "meta",
  });
  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: "/download",
    title: t("downloadTitle"),
    description: t("downloadDescription"),
  });
}

/** The step digits are labels, not prose, so they stay out of the catalogue. */
const STEP_DIGITS = ["01", "02", "03"];
const STEP_KEYS = [
  ["step1Title", "step1Body"],
  ["step2Title", "step2Body"],
  ["step3Title", "step3Body"],
] as const;

export default async function DownloadPage() {
  const t = await getTranslations("download");

  return (
    <PageShell>
      <section className="section" data-reveal style={{ paddingTop: "clamp(36px,7vh,72px)" }}>
        <div className="dl-hero">
          <span className="eyebrow">
            <i aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
        </div>
        <DownloadPlatforms />
      </section>
      <section className="section" data-reveal style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2 className="sec-title">{t("howItWorks")}</h2>
          <p className="sec-sub">{t("howSub")}</p>
        </div>
        <div className="dl-steps">
          {STEP_KEYS.map(([titleKey, bodyKey], i) => (
            <div className="panel dl-step" key={STEP_DIGITS[i]}>
              <span className="n">{STEP_DIGITS[i]}</span>
              <b>{t(titleKey)}</b>
              <p>{t(bodyKey)}</p>
            </div>
          ))}
        </div>

        <div className="panel dl-flow" style={{ padding: "20px 22px", marginTop: 20 }}>
          <div>
            <b style={{ fontSize: 15 }}>{t("wireTitle")}</b>
            <p className="meta" style={{ marginTop: 6 }}>
              {t("wireBody")}
            </p>
            <code style={{ display: "block", marginTop: 10 }}>https://api.vipai.site/v1</code>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary btn-lg" href="/dashboard/api-keys">
              {t("ctaKey")}
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/docs/api-integration">
              {t("ctaDocs")}
              <Icon name="ic-arrow" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
