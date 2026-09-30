/**
 * The subset of the message catalogue that crosses into the browser.
 *
 * `NextIntlClientProvider` serialises its `messages` into the RSC payload of
 * every page, so whatever is passed here is downloaded by every visitor on
 * every route. Passing the whole catalogue meant that ~7KB of prose that only a
 * Server Component ever renders — page titles, and the four content pages —
 * shipped to the client and was never looked up.
 *
 * The names omitted are exactly the ones with no `useTranslations("…")` in a
 * Client Component:
 *
 *   meta      page titles and descriptions (`generateMetadata`)
 *   about     `/about` prose
 *   download  `/download` prose
 *   catalogue `/models` prose
 *   model     `/models/[id]` prose
 *
 * If one of these is ever needed in a client component, move it out of this
 * list in the same change — otherwise the component throws a missing-message
 * error at runtime while the build stays green (`check:i18n` compares locales,
 * not which side of the boundary a namespace is used from).
 */
const SERVER_ONLY = new Set(["meta", "about", "download", "catalogue", "model"]);

export function clientMessages<T extends Record<string, unknown>>(messages: T): T {
  const out = {} as Record<string, unknown>;
  for (const [namespace, value] of Object.entries(messages)) {
    if (!SERVER_ONLY.has(namespace)) out[namespace] = value;
  }
  return out as T;
}
