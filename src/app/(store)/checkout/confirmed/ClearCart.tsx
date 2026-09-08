"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";

/**
 * Empties the cart once, when `when` first becomes true.
 *
 * `when` exists because checkout now leaves the site. The rules, and why:
 *
 *   - Cleared once payment is CONFIRMED, or on the manual path where the order is the whole
 *     transaction.
 *   - Never on cancel — the customer is coming back to buy, and wiping their cart at exactly that
 *     moment is the worst possible time to do it. (That page doesn't render this at all.)
 *   - Not while confirmation is still pending: the poll flips to paid within seconds and clears
 *     then. If it never resolves, the cart SURVIVES — a stale cart is an annoyance, a cart wiped
 *     after a payment that didn't go through is lost revenue and an angry customer.
 *
 * The ref guards against React's development double-invoke and against a re-render clearing a cart
 * the customer has since started rebuilding in another tab.
 *
 * WAITING FOR `hydrated` IS NOT OPTIONAL. Effects run child-first, and this component sits far
 * below the `CartProvider` in the tree — so on a full page load it fires BEFORE the provider has
 * loaded the cart. Clearing an empty placeholder achieves nothing, and the hydration that follows
 * a moment later puts every line straight back. That was the bug: the cart cleared correctly on
 * the manual path (a client-side navigation, where the provider was already mounted) and never on
 * the PayMongo path, where returning from the gateway is a full page load. `hydrated` is the
 * provider's own answer to "have I loaded yet", and this must not act before it says yes.
 *
 * This is now the SECOND of two clears, and the lesser one. An order reaching `paid` empties the
 * customer's stored cart server-side (see `applyOrderPayment`), which is what makes the cart clear
 * on their other devices and on this one even if they never load this page. This clears the local
 * copy immediately so the header count drops the instant they see "Payment received".
 */
export function ClearCart({ when = true }: { when?: boolean }) {
  const { clear, hydrated } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !when || !hydrated) return;
    done.current = true;
    clear();
  }, [clear, when, hydrated]);

  return null;
}
