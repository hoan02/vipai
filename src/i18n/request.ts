import { getRequestConfig } from "next-intl/server";
import { isLocale, routing } from "./routing";

/**
 * Per-request locale and messages, resolved on the server.
 *
 * This is the piece that replaces the DOM sweep: the locale comes from the URL
 * (set by the proxy), and the message catalogue for that locale is what every
 * server component renders — so the HTML a crawler receives is already in the
 * right language, with no client-side rewriting.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
