import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { isLocale, routing } from "./routing";

/**
 * Per-request locale and messages, resolved on the server.
 *
 * This is the piece that replaces the DOM sweep: the locale comes from the
 * `[locale]` root parameter — the URL the proxy rewrote to, which is what makes
 * `/` and `/vi` two different renders — and the message catalogue for that
 * locale is what every server component renders, so the HTML a crawler receives
 * is already in the right language, with no client-side rewriting.
 *
 * `next/root-params` is read here rather than a per-page `setRequestLocale`:
 * the getter is valid in any Server Component under this root layout, so one
 * call covers the whole tree and nothing has to be re-declared per page. An
 * explicit locale passed to e.g. `getTranslations({locale})` still wins, which
 * is the escape hatch for the surfaces root params do not cover.
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const requested = explicitLocale ?? (await rootLocale());
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
