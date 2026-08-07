/**
 * The one-hour window a customer has to finish paying — CLIENT-SAFE.
 *
 * After checkout the customer lands on `/checkout/pay` rather than being thrown straight at
 * PayMongo, so they can leave and come back. This module holds the single definition of how long
 * that lasts and how the pointer to it is stored, because the server action, the pay page and
 * three client components all have to agree — the same "one function, one number" argument
 * `shipping.ts` makes about the delivery fee.
 *
 * THE COOKIE IS A BOOKMARK, NOT A CAPABILITY. It holds a Firestore document id, an order ref and
 * a display expiry. `/checkout/pay` re-reads the order and decides everything from the document:
 * payment status, whether a checkout URL exists, and — critically — whether the window has closed,
 * which is read from `order.checkoutExpiresAt` and NEVER from the `exp` below. That invariant is
 * what makes it safe for the cookie to be unsigned and readable by client JS: no attacker-supplied
 * value reaches `expireCheckoutSession` or `applyOrderPayment`.
 *
 * Why unsigned and non-httpOnly, given `auth.ts` signs its cookie and hides it:
 *
 *   - The order id IS the secret, at ~119 bits, and we already accept it unsigned in a URL on
 *     `/checkout/confirmed?o=`. Signing a cookie while shipping the same id in a query string
 *     would be theatre.
 *   - An HMAC can't be verified in the browser without shipping the secret, so signing would force
 *     the site-wide banner into a server round trip on every page view.
 *   - Reading it server-side in the storefront layout would make `cookies()` run there, which
 *     turns ~130 prerendered routes dynamic. The banner reads `document.cookie` instead.
 *   - A Server Component physically cannot delete a cookie, so httpOnly would mean building a
 *     route handler just to clean up on the confirmation page.
 *
 * `parsePendingPayment` still validates shape strictly — not for authenticity, but because the id
 * is interpolated into a Firestore document path. Same defensive posture as `toOrder()`.
 */

/** How long a PayMongo session stays resumable. Stamped onto the order at creation. */
export const PAY_WINDOW_MS = 60 * 60 * 1000;
export const PAY_WINDOW_MINUTES = PAY_WINDOW_MS / 60_000;

export const PAY_COOKIE = "rrnt_pay";

/**
 * The cookie deliberately OUTLIVES the window by an hour.
 *
 * Expiry is enforced server-side from the order, so the extra hour grants nothing. It exists so a
 * customer wandering back at minute 75 gets "your payment window expired, nothing was charged,
 * your cart is still here" instead of a bare "no payment in progress" — the difference between a
 * customer who trusts you and one who wonders whether they were charged. The banner hides itself
 * at `exp`, so the tail is invisible in the UI.
 */
export const PAY_COOKIE_GRACE_MS = 60 * 60 * 1000;
export const PAY_COOKIE_MAX_AGE = (PAY_WINDOW_MS + PAY_COOKIE_GRACE_MS) / 1000;

/** Outside data, so it gets a cap like every other field crossing the boundary. */
const MAX_PAY_COOKIE_BYTES = 200;

export type PendingPayment = {
  /** Firestore document id of the order. */
  orderId: string;
  /** Human-readable code, shown in the banner so the customer recognises it. */
  ref: string;
  /** Epoch ms the window closes. DISPLAY ONLY — never trusted for a decision. */
  exp: number;
};

/**
 * Firestore auto-ids are 20 chars of [A-Za-z0-9], but accept the wider slug alphabet in case one
 * is ever supplied by hand. The point of the guard is the characters it EXCLUDES: a "/" here
 * produces an odd-segment document path, which Firestore rejects by throwing — a 500 on a
 * customer-facing page instead of a friendly "no payment in progress".
 */
export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/**
 * `v1.<orderId>.<ref>.<exp>` — delimited rather than base64url.
 *
 * `auth.ts` uses base64url because its cookie is an opaque signed token. This one is meant to be
 * transparent: it parses in the browser with `split(".")` and no `atob`, and it reads as a pointer
 * rather than a credential when someone opens devtools. Every component is `.`-free by
 * construction, and the `v1` prefix makes a future shape change detectable rather than silently
 * misparsed.
 */
export function serializePendingPayment(pending: PendingPayment): string {
  return `v1.${pending.orderId}.${pending.ref}.${Math.floor(pending.exp)}`;
}

/** Never throws. Anything malformed is simply "no pending payment". */
export function parsePendingPayment(raw: string | undefined | null): PendingPayment | null {
  if (!raw || raw.length > MAX_PAY_COOKIE_BYTES) return null;

  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  const [, orderId, ref, exp] = parts;
  if (!isOrderId(orderId)) return null;
  if (!/^[A-Z0-9-]{1,20}$/.test(ref)) return null;
  if (!/^\d{1,15}$/.test(exp)) return null;

  return { orderId, ref, exp: Number(exp) };
}

/**
 * Is this order still payable?
 *
 * `0` means no window was ever recorded — an order written before this shipped. Those are treated
 * as OPEN: a deploy must never retroactively declare historical orders expired.
 */
export function isPayWindowOpen(checkoutExpiresAt: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(checkoutExpiresAt) || checkoutExpiresAt <= 0) return true;
  return checkoutExpiresAt > now;
}

/** Whole minutes remaining, rounded up so "1 minute left" never renders as "0". */
export function minutesLeft(exp: number, now: number = Date.now()): number {
  if (!Number.isFinite(exp)) return 0;
  return Math.max(0, Math.ceil((exp - now) / 60_000));
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser helpers — no-ops on the server, so they're safe to import anywhere.
// ─────────────────────────────────────────────────────────────────────────────

export function readPendingPaymentCookie(): PendingPayment | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PAY_COOKIE}=`));
  return match ? parsePendingPayment(decodeURIComponent(match.slice(PAY_COOKIE.length + 1))) : null;
}

/** Expire it in the past — the only way to remove a cookie from the browser. */
export function clearPendingPaymentCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PAY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
