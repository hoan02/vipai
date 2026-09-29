import { SvgSprite } from "@/lib/icons";
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

export default async function Page() {
  const models = await getPublicModels();
  // Every "up to N% off" claim on the page reads this, so no copy can promise
  // more than the gateway actually bills.
  const maxOff = models.reduce((max, m) => Math.max(max, m.discPct), 0);

  return (
    <>
      <SvgSprite />
      <SiteMotion />
      <LaunchBanner />
      <Nav />
      <Hero maxOff={maxOff} />
      <Pricing models={models} />
      <StatBar />
      <BuyHook />
      <QuickStart />
      <Features maxOff={maxOff} />
      <Duo />
      <Tier />
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
