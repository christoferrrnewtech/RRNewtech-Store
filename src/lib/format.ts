/** Formatting helpers shared across the storefront. */

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a whole-peso amount, e.g. 1450 → "₱1,450". */
export function formatPHP(amount: number): string {
  return peso.format(amount);
}

/*
 * Date-only helpers for training sessions.
 *
 * Campaigns are advertised by MONTH AND YEAR only — the stored `date` still carries a full day
 * because sorting and the past-date cutoff need one, but the exact day is never shown. Sessions
 * often run across several days, so naming one would be wrong as often as right.
 *
 * `timeZone: "UTC"` is load-bearing, not decoration: `new Date("2026-09-18")` parses as UTC
 * midnight, so formatting it in any behind-UTC zone renders the previous day — which at the start
 * of a month would show the wrong month entirely.
 */
const monthShortFmt = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Month and year for the calendar tile, e.g. `{ month: "Apr", year: "2027" }`. */
export function sessionDateParts(iso: string): { month: string; year: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  return { month: monthShortFmt.format(d), year: String(d.getUTCFullYear()) };
}

/** Readable month and year, e.g. "April 2027". */
export function formatSessionDate(iso: string): string {
  return monthYearFmt.format(new Date(`${iso}T00:00:00Z`));
}

/** Percentage saved when a compareAtPrice is present, e.g. 17 (for "17% off"). */
export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
