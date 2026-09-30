/**
 * The FAQ: its order, and the keys its text lives under.
 *
 * The questions and answers are content, so they live in
 * `messages/<locale>.json` under `faq.items.<key>` rather than in a TypeScript
 * module. That is what lets one list feed both the rendered accordion and the
 * `FAQPage` structured data, in whichever language the page is being served —
 * and it keeps the markup describing exactly the answers the reader sees.
 */

export const FAQ_KEYS = [
  "router",
  "compatibility",
  "discount",
  "training",
  "credits",
  "realModels",
  "verifyPrice",
  "refund",
] as const;

export type FaqKey = (typeof FAQ_KEYS)[number];

/** The shape of a `t` from `useTranslations("faq")` / `getTranslations("faq")`,
 *  narrowed to what this module needs so it can take either. */
export type FaqTranslate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The list, resolved for one locale.
 *
 * The discount entry carries `{n}`, the live top discount, so it is interpolated
 * here rather than stored as a figure that could go stale in one language.
 */
export function faqItems(t: FaqTranslate, maxOff: number): Array<{ key: FaqKey; q: string; a: string }> {
  return FAQ_KEYS.map((key) => ({
    key,
    q: t(`items.${key}.q`, { n: maxOff }),
    a: t(`items.${key}.a`, { n: maxOff }),
  }));
}
