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
 */
export function ClearCart({ when = true }: { when?: boolean }) {
  const { clear } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !when) return;
    done.current = true;
    clear();
  }, [clear, when]);

  return null;
}
