import { SvgSprite } from "@/lib/icons";
import { SiteMotion } from "@/components/SiteMotion";
import { LaunchBanner } from "@/components/LaunchBanner";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TelegramCta } from "@/components/TelegramCta";
import { Pricing } from "@/components/Pricing";
import { QuickStart } from "@/components/QuickStart";
import { LiveDiscounts } from "@/components/LiveDiscounts";
import { Faq } from "@/components/Faq";
import { TopUpModal } from "@/components/TopUpModal";
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
} from "@/components/Sections";

export default function Page() {
  return (
    <>
      <SvgSprite />
      <SiteMotion />
      <LaunchBanner />
      <Nav />
      <Hero />
      <Pricing />
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
