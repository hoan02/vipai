import { defineRouting } from "next-intl/routing";

/** The cookie next-intl writes when a visitor picks a language. The OAuth
 *  callback reads it to land the visitor back in the language they started in. */
export const LOCALE_COOKIE = "vipai.locale";

/**
 * Locale routing for vipai.site.
 *
 * `as-needed` means the default locale carries no prefix and every other locale
 * does. The default is `en` **for now** and flips to `vi` at the end of the
 * migration. The flip is the only change that moves URLs a crawler already
 * knows (`/` stops being English, `/docs/*` becomes `/en/docs/*`), so it is
 * deliberately the last step: until then `/vi` is a pure addition and nothing
 * indexed is disturbed.
 */
export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // No automatic redirect. A visitor on `/` is never bounced to `/vi` by a cookie
  // or an `Accept-Language` header: the switcher is the only thing that changes
  // the URL. That keeps both locales crawlable and means a shared link always
  // shows what the sender saw.
  localeDetection: false,
  // The middleware would otherwise emit a `Link` header advertising every
  // locale for every route — including docs, which have no Vietnamese
  // counterpart, and `/vi/*`, which is still noindex. Phase 3 emits hreflang
  // from each page's own metadata, where "which locales exist here" is known.
  alternateLinks: false,
  // Mirrors the key the old DOM sweep used, so a visitor's choice survives the
  // migration instead of resetting on first load.
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
});

export type Locale = (typeof routing.locales)[number];

/** Narrowing guard for a value that came from a URL param or a cookie. */
export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/**
 * The path a locale serves for a locale-neutral route.
 *
 * `as-needed` means the default locale carries no prefix and every other locale
 * does, so this is the one place that decides what a URL looks like. Used by the
 * proxy for redirects, by `requireAccountOrRedirect` for the sign-in bounce, and
 * by metadata for canonicals.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === routing.defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** The inverse of `localePath`: which locale a request path asks for, and the
 *  path without its prefix. Prefix matching is longest-locale-first so a future
 *  `pt-BR` cannot be shadowed by `pt`. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const prefixed = [...routing.locales]
    .filter((locale) => locale !== routing.defaultLocale)
    .sort((a, b) => b.length - a.length);

  for (const locale of prefixed) {
    if (pathname === `/${locale}`) return { locale, path: "/" };
    if (pathname.startsWith(`/${locale}/`)) return { locale, path: pathname.slice(locale.length + 1) };
  }

  return { locale: routing.defaultLocale, path: pathname };
}
