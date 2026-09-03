/**
 * "Is someone signed in?" for the browser — CLIENT-SAFE.
 *
 * The real customer session (`rrnt_customer`) is httpOnly and signed, because it IS the
 * credential. That makes it invisible to client JS, which is correct — and inconvenient for the
 * one thing the browser genuinely needs to know on its own: whether to let an Add-to-cart click
 * through or raise the sign-in prompt.
 *
 * So `createCustomerSession` writes this second, deliberately readable cookie alongside it,
 * carrying no information beyond "a session was issued". Same trade-off `pay-window.ts` documents:
 * the storefront layout wraps ~130 prerendered routes, and one `cookies()` call there would turn
 * every product and brand page into an origin hit with a Firestore round trip for the header menus.
 *
 * THIS IS A HINT, NOT AUTHORIZATION. It is unsigned, user-writable, and trivially forged from
 * devtools — so the worst a forger achieves is showing themselves a cart they could already build
 * by other means. Nothing downstream trusts it: `/account` calls `requireCustomer`, and every
 * server action re-reads the signed session. Never gate anything that matters on this value; if
 * you find yourself wanting to, read the session server-side in that route instead.
 *
 * It can also go stale — a 30-day session cookie and this one expire together, but clearing site
 * data or an account deleted server-side leaves it briefly wrong in one direction or the other.
 * That costs a spurious prompt or a spurious pass, and nothing else.
 */

export const CUSTOMER_HINT_COOKIE = "rrnt_signed_in";

/** Does the browser think a customer is signed in? Always false during SSR. */
export function hasCustomerSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((row) => row === `${CUSTOMER_HINT_COOKIE}=1`);
}
