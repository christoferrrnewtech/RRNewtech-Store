/**
 * Customer field rules — the single source of truth for both sides of every public form: sign-up,
 * checkout, contact and quote request.
 *
 * The forms use these for `pattern`/`maxLength` hints so a typo is caught before a round trip; the
 * server actions re-check every one of them, because HTML validation is a convenience for humans
 * and no obstacle at all to anything else.
 *
 * No `server-only` import: this is deliberately importable from client components.
 *
 * Patterns are written for BOTH consumers: `new RegExp` here and the HTML `pattern` attribute,
 * which browsers compile with the `v` flag — so a literal `-` inside a character class must be
 * escaped, or the browser silently ignores the whole pattern.
 */

/**
 * Field caps. Generous for a real person, small enough that a document can't be bloated — and,
 * on the public forms, short enough that a spam payload can't ride in through a name field.
 */
export const MAX_NAME = 60;
/** The contact and quote forms ask for one "Full name" rather than a first/last pair. */
export const MAX_FULL_NAME = 80;
/** Clinic or company name on the contact and quote forms. */
export const MAX_ORGANIZATION = 100;
export const MAX_EMAIL = 200;
/** Firebase Auth's own floor is 6 characters; we ask for a little more. */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/**
 * Philippine mobile number, as people actually type one: `0917-123-4567`, `09171234567`,
 * `0917 123 4567` or `+63 917 123 4567`. All carry the same number — `normalizePhone` strips the
 * separators and rewrites `+63` to `0`, so exactly one shape (09XXXXXXXXX) is ever stored.
 */
export const PHONE_PATTERN = "(\\+?63|0)[\\s\\-]?9\\d{2}[\\s\\-]?\\d{3}[\\s\\-]?\\d{4}";
/** Long enough for the widest accepted shape, "+63 917 123 4567". */
export const PHONE_MAX_LENGTH = 16;

/**
 * Something@domain.tld, with a letters-only TLD of two or more. Rejects what the browser's own
 * `type="email"` lets through (`juan@gmail`) and the common slips (`juan@gmail.c`, `juan@gmail..com`).
 */
export const EMAIL_PATTERN = "[^\\s@]+@([A-Za-z0-9\\-]+\\.)+[A-Za-z]{2,}";
const EMAIL_RE = new RegExp(`^${EMAIL_PATTERN}$`);

/** PRC licence numbers are 6 or 7 digits. */
export const PRC_PATTERN = "\\d{6,7}";
const PRC_RE = new RegExp(`^${PRC_PATTERN}$`);

/** Good enough to catch typos and obvious junk. Real deliverability is proven by replying. */
export function looksLikeEmail(value: string): boolean {
  return value.length <= MAX_EMAIL && EMAIL_RE.test(value);
}

/**
 * Strip spaces and dashes, turn a +63 prefix into 0, then check the result is a valid
 * 09XXXXXXXXX number. Returns the canonical 11-digit form, or "" when the input isn't one.
 */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s-]/g, "").replace(/^\+?63(?=9)/, "0");
  return /^09\d{9}$/.test(compact) ? compact : "";
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
