import type { Locale } from "@/components/site/I18n";

/**
 * Date and time formatting that follows the app locale.
 *
 * Vietnamese uses the day-first, zero-padded shape the product asks for —
 * `29/09/2026`, `29/09 14:05`, `29/09 14:05:07` — and drops the year where
 * the caller did not want it. English keeps the month-name form the pages
 * were built with (`Sep 29, 2026`, `Sep 29, 02:05 PM`).
 *
 * `Intl` is used for English (so AM/PM and the month name stay right) but not
 * for Vietnamese: `vi-VN` renders `29/9/2026` without zero padding, and the
 * product wants `29/09/2026`.
 */

const pad = (value: number) => String(value).padStart(2, "0");

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-09-29` → `29/09/2026` (vi) or `Sep 29, 2026` (en). */
export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: { year?: boolean } = {},
): string {
  const date = toDate(value);
  if (!date) return String(value);
  const { year = true } = options;

  if (locale === "vi") {
    const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    return year ? `${day}/${date.getFullYear()}` : day;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
  }).format(date);
}

/** A date with a clock, e.g. `29/09/2026 14:05` / `Sep 29, 2026, 02:05 PM`. */
export function formatDateTime(
  value: string | number | Date,
  locale: Locale,
  options: { year?: boolean; seconds?: boolean } = {},
): string {
  const date = toDate(value);
  if (!date) return String(value);
  const { year = true, seconds = false } = options;

  if (locale === "vi") {
    const clock = seconds
      ? `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${formatDate(date, locale, { year })} ${clock}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  }).format(date);
}
