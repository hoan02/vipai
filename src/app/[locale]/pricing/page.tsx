import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { PageShell } from "@/components/site/PageShell";
import { Pricing } from "@/components/site/Pricing";
import { Faq } from "@/components/site/Faq";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicModels } from "@/server/pricing";
import { translatedPageMeta } from "@/lib/seo";
import { breadcrumbs, faqSchema, modelListSchema } from "@/lib/schema";
import { faqItems } from "@/lib/faq";

/**
 * The catalogue is read with a 60s `revalidate` (see `server/pricing.ts`), so
 * this route renders statically and is served from the edge; the gateway is hit
 * at most once per minute rather than on every request.
 *
 * `force-dynamic` was here before, and it also forced every `fetch` in the route
 * to `no-store` — so it silently defeated that revalidate and asked the gateway
 * for the whole price list on every page view.
 */
export const revalidate = 60;

// Translated in both locales, so the canonical is this locale's URL and the two
// are paired with hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The locale is passed explicitly so this stays static: a bare
  // `getTranslations()` reads the request locale and opts the route into
  // dynamic rendering.
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    namespace: "meta",
  });
  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: "/pricing",
    title: t("pricingTitle"),
    description: t("pricingDescription"),
  });
}

/**
 * The catalogue's own page.
 *
 * The homepage carries a truncated view of this table; a dedicated URL gives
 * the prices a page of their own to rank and to link to, and lets the pricing
 * table's "see all" state be a plain server render rather than a hash anchor.
 */
export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;
  const models = await getPublicModels();
  const maxOff = models.reduce((max, m) => Math.max(max, m.discPct), 0);
  // The page prose is translated here rather than by the DOM sweep, so the
  // server sends the reader's language (see the note in `components/site/I18n.tsx`).
  const t = await getTranslations("pricingPage");
  // The structured data speaks the same language as the page it describes.
  const faq = faqItems(await getTranslations("faq"), maxOff);

  return (
    <PageShell>
      <JsonLd
        data={[
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          modelListSchema(models),
          faqSchema(faq, locale),
        ]}
      />

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="prose-page">
          <h1>{t("title")}</h1>
          <p className="lede">
            Every model VipAI routes, with the provider&rsquo;s published list price beside ours, so the
            discount is something you can check rather than take on trust. Billed per token in USD, no
            subscription, credits never expire.
          </p>
        </div>
      </section>

      <Pricing models={models} liveHref={null} defaultExpanded />

      <Faq maxOff={maxOff} />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="prose-page">
          <h2>How billing works</h2>
          <p>
            You are charged per million tokens, separately for input and output, at the rate shown in the
            table above. Prices move with upstream provider costs, and each request is billed at the rate in
            effect when it was made.
          </p>
          <ul>
            <li>
              <strong>Input and output</strong> are metered separately, so a model with expensive output
              costs more on a long completion than on a long prompt.
            </li>
            <li>
              <strong>Prompt cache</strong> reads are charged at the cache rate in the table, which is a
              fraction of the input rate on models that support it.
            </li>
            <li>
              <strong>Complimentary models</strong> — ids ending in <code>-free</code>, plus{" "}
              <code>jev</code> — run at a promotional discount with a personal daily allowance and a shared
              platform capacity. <Link href="/docs/rate-limits">{t("rateLimits")}</Link> has the numbers.
            </li>
            <li>
              <strong>No subscription.</strong> Buy credits when you want, spend them whenever; a balance
              that runs out stops requests rather than becoming a debt.
            </li>
          </ul>
          <p>
            Why one message can produce several billing rows, and how cache is priced, is covered in{" "}
            <Link href="/docs/billing">billing questions</Link>. The request formats are in{" "}
            <Link href="/docs/api-integration">the API reference</Link>, and the full id list is in{" "}
            <Link href="/models">the model catalogue</Link>.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
