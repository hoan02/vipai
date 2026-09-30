import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Geist, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import "../site-pages.css";
import { I18n } from "@/components/site/I18n";
import { AuthModal, CommandPalette, Toaster } from "@/components/site/overlays";
import { ThemeProvider } from "@/components/theme-provider";
import { isLocale, routing } from "@/i18n/routing";
import { clientMessages } from "@/i18n/client-messages";
import { BASE_OPEN_GRAPH, OG_IMAGE, SITE_URL } from "@/lib/seo";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-geist",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-src",
  display: "swap",
});

/**
 * The share card is defined in `lib/seo.ts` as part of `BASE_OPEN_GRAPH`, so a
 * page that overrides `openGraph` through `pageMeta()` cannot drop it.
 */

/**
 * Every page renders once per locale. With `localePrefix: "as-needed"` the
 * default locale's HTML is what `/` serves; the other locale is served from its
 * own prefixed URL.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("meta");

  return {
    // Required before any relative URL can appear in metadata: the canonical
    // links, the OG image and og:url all resolve against this.
    metadataBase: new URL(SITE_URL),
    // The default is what a page without a title of its own inherits, and it is
    // localized, so the fallback is in the reader's language. The template
    // appends the brand to a page's own title ("Pricing" -> "Pricing — VipAI");
    // a page that wants the whole string sets `title.absolute` instead, which
    // is what `translatedPageMeta` does.
    title: { default: t("homeTitle"), template: "%s — VipAI" },
    description: t("homeDescription"),
    applicationName: "VipAI",
    openGraph: { ...BASE_OPEN_GRAPH },
    twitter: {
      card: "summary_large_image",
      title: t("homeTitle"),
      description: t("homeDescription"),
      images: [OG_IMAGE],
    },
    // Safe default: only the default locale is indexable. Most of the tree is
    // still English prose — `/about`, `/models`, `/download`, the legal pages —
    // and serving that under a Vietnamese URL would publish a duplicate. A page
    // whose content *is* translated opts itself in through
    // `translatedPageMeta()`, which sets `robots` explicitly.
    //
    // Note for step 4 (the locale flip): this rule is keyed on which locale is
    // default, so flipping it inverts every page at once. By then each page must
    // state its own `robots` rather than inherit one.
    robots:
      locale === routing.defaultLocale
        ? { index: true, follow: true }
        : { index: false, follow: false },
    icons: {
      icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }],
      shortcut: ["/favicon.png"],
      apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // The locale is resolved in `i18n/request.ts` from this layout's root
  // parameter, so the tree below stays statically rendered without each page
  // having to opt in itself.

  // Only the namespaces a Client Component actually reads cross the boundary;
  // see `i18n/client-messages.ts`.
  const messages = clientMessages(await getMessages());

  return (
    // suppressHydrationWarning: next-themes sets data-theme on <html> before
    // React hydrates, so the server and client class/attribute lists differ by
    // design. This only silences the warning on this one element.
    //
    // `lang` comes from the URL segment, so it is correct in the HTML a crawler
    // receives. `<I18n/>` still rewrites copy after hydration while the message
    // catalogue is migrated; it no longer has to correct `lang`.
    <html lang={locale} className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <I18n />
            {children}
            <AuthModal />
            <CommandPalette />
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
