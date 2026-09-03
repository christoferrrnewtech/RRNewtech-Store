/**
 * Customer sign-up field rules — the single source of truth for both sides of the form.
 *
 * The register form uses these for `pattern`/`maxLength` hints so a typo is caught before a round
 * trip; the server action re-checks every one of them, because HTML validation is a convenience for
 * humans and no obstacle at all to anything else.
 *
 * No `server-only` import: this is deliberately importable from client components.
 */

/** Field caps. Generous for a real person, small enough that a document can't be bloated. */
export const MAX_NAME = 60;
export const MAX_EMAIL = 200;
/** Firebase Auth's own floor is 6 characters; we ask for a little more. */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/**
 * Philippine mobile number, in either of the two formats the sign-up form accepts:
 * `09XX-XXX-XXXX` or `09XXXXXXXXX`. Both carry the same 11 digits — the dashes are cosmetic and
 * `normalizePhone` strips them, so exactly one shape is ever stored.
 */
export const PHONE_PATTERN = "09\\d{2}-?\\d{3}-?\\d{4}";
const PHONE_RE = new RegExp(`^${PHONE_PATTERN}$`);

/** PRC licence numbers are 6 or 7 digits. */
export const PRC_PATTERN = "\\d{6,7}";
const PRC_RE = new RegExp(`^${PRC_PATTERN}$`);

/** Good enough to catch typos and obvious junk. Real deliverability is proven by the verify email. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Strip spaces and dashes, then check the result is a valid 09XXXXXXXXX number.
 * Returns the canonical 11-digit form, or "" when the input isn't one.
 */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s-]/g, "");
  return PHONE_RE.test(compact) ? compact : "";
}

/** Display form of a stored number: 09XX-XXX-XXXX. */
export function formatPhone(value: string): string {
  return /^\d{11}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 7)}-${value.slice(7)}`
    : value;
}

export function isPrcId(value: string): boolean {
  return PRC_RE.test(value.trim());
}

/** Images we can actually re-encode server-side. HEIC from an iPhone is not in this list. */
export const PRC_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PRC_IMAGE_ACCEPT = PRC_IMAGE_TYPES.join(",");
export const MAX_PRC_IMAGE_BYTES = 8 * 1024 * 1024;
