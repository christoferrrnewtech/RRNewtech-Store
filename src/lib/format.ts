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

/** Percentage saved when a compareAtPrice is present, e.g. 17 (for "17% off"). */
export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
