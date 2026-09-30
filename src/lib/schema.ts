import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { TELEGRAM_URL } from "@/lib/site";
import type { Model } from "@/lib/data";
import { modelSlug } from "@/lib/data";

/**
 * JSON-LD builders, one per entity the site actually shows.
 *
 * Kept together and typed loosely on purpose: a schema is data, not a UI, and
 * the only rule is that every value here must also be visible on the page it is
 * attached to — markup that describes something the reader cannot see is what
 * search engines penalise.
 */

export type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;

/** Prices arrive pre-formatted ("$3.00", "$0.4350"); the schema wants a number. */
function price(value: string): number | undefined {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo.webp`,
    description:
      "VipAI is an AI API gateway: one key for GPT, Claude, Gemini and other leading models, billed per token at a discount to list.",
    sameAs: [TELEGRAM_URL],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: TELEGRAM_URL,
        availableLanguage: ["en", "vi"],
      },
    ],
  };
}

export function webSiteSchema(locale: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: locale,
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplicationSchema(maxOff: number, locale: string): Json {
  const offer: Json = {
    "@type": "Offer",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/pricing`,
  };
  if (maxOff > 0) offer.description = `Model rates are up to ${maxOff}% below the provider list price.`;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    // The block is rendered per page, so it declares the language of the page it
    // sits on rather than a fixed one.
    inLanguage: locale,
    description:
      "An LLM router for developers: one OpenAI-, Anthropic- and Gemini-compatible endpoint in front of every major model provider, with one metered bill.",
    featureList: [
      "OpenAI-compatible /v1 endpoint",
      "Anthropic-compatible /v1/messages endpoint",
      "Gemini native endpoint",
      "Prompt caching and automatic fallbacks",
      "Per-token billing with no subscription",
    ],
    provider: { "@id": ORG_ID },
    offers: offer,
  };
}

export function faqSchema(items: Array<{ q: string; a: string }>, locale: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function breadcrumbs(trail: Array<{ name: string; path: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function techArticle(args: { title: string; description: string; path: string }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: args.title,
    description: args.description,
    url: `${SITE_URL}${args.path}`,
    mainEntityOfPage: `${SITE_URL}${args.path}`,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

/** One catalogue row as a Product, so a price can surface in a result. */
export function productSchema(model: Model): Json {
  const inPrice = price(model.inNow);
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: model.name,
    sku: model.id,
    category: model.vendor,
    brand: { "@type": "Brand", name: "VipAI" },
    url: `${SITE_URL}/models/${modelSlug(model.id)}`,
  };
  if (inPrice !== undefined) {
    schema.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: inPrice,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/pricing`,
    };
  }
  return schema;
}

/** The catalogue as an ordered ItemList, for the pricing page. */
export function modelListSchema(models: Model[], limit = 60): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "VipAI model pricing",
    numberOfItems: Math.min(models.length, limit),
    itemListElement: models.slice(0, limit).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${m.name} — ${m.inNow} / 1M input tokens`,
      url: `${SITE_URL}/models/${modelSlug(m.id)}`,
    })),
  };
}
