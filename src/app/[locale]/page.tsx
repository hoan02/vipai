import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SvgSprite } from "@/lib/icons";
import { translatedPageMeta } from "@/lib/seo";
import { isLocale, routing } from "@/i18n/routing";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema, organizationSchema, softwareApplicationSchema, webSiteSchema } from "@/lib/schema";
import { faqItems } from "@/lib/faq";
import { SiteMotion } from "@/components/site/SiteMotion";
import { LaunchBanner } from "@/components/site/LaunchBanner";
import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { TelegramCta } from "@/components/site/TelegramCta";
import { Pricing } from "@/components/site/Pricing";
import { QuickStart } from "@/components/site/QuickStart";
import { LiveDiscounts } from "@/components/site/LiveDiscounts";
import { Faq } from "@/components/site/Faq";
import { TopUpModal } from "@/components/site/TopUpModal";
import { getPublicModels } from "@/server/pricing";
import {
  StatBar,
  BuyHook,
  Features,
  Duo,
  Tier,
  Leaderboard,
  CtaSection,
  Finale,
  Footer,
} from "@/components/site/Sections";

export const dynamic = "force-dynamic";

// The homepage exists in both locales, so its canonical is its own URL and the
// two are paired with hreflang. The title and description are the layout's
// default, localized, which is why `translatedPageMeta` still receives them:
// they are also the Open Graph pair a shared link shows.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("meta");
  return translatedPageMeta({
    locale: isLocale(locale) ? locale : routing.defaultLocale,
    path: "/",
    title: t("homeTitle"),
    description: t("homeDescription"),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;
  const models = await getPublicModels();
  // Every "up to N% off" claim on the page reads this, so no copy can promise
  // more than the gateway actually bills.
  const maxOff = models.reduce((max, m) => Math.max(max, m.discPct), 0);
  // The structured data speaks the same language as the page it describes.
  const faq = faqItems(await getTranslations("faq"), maxOff);

  return (
    <>
      <SvgSprite />
      {/* The FAQ and price claims rendered below are the same ones this markup
          describes: structured data must only assert what the page shows. */}
      <JsonLd
        data={[
          organizationSchema(),
          webSiteSchema(locale),
          softwareApplicationSchema(maxOff, locale),
          faqSchema(faq, locale),
        ]}
      />
      <SiteMotion />
      <LaunchBanner />
      <Nav />
      <Hero maxOff={maxOff} />
      <Pricing models={models} />
      <StatBar />
      <BuyHook maxOff={maxOff} />
      <QuickStart />
      <Features maxOff={maxOff} />
      <Duo />
      <Tier maxOff={maxOff} />
      <LiveDiscounts models={models} />
      <Leaderboard />
      <TelegramCta />
      <CtaSection maxOff={maxOff} />
      <Faq maxOff={maxOff} />
      <Finale />
      <Footer />
      <TopUpModal />
    </>
  );
}
