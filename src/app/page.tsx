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

export default async function Page() {
  const models = await getPublicModels();

  return (
    <>
      <SvgSprite />
      <SiteMotion />
      <LaunchBanner />
      <Nav />
      <Hero />
      <Pricing models={models} />
      <StatBar />
      <BuyHook />
      <QuickStart />
      <Features />
      <Duo />
      <Tier />
      <LiveDiscounts />
      <Leaderboard />
      <TelegramCta />
      <CtaSection />
      <Faq />
      <Finale />
      <Footer />
      <TopUpModal />
    </>
  );
}
