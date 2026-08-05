"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";

/**
 * Empties the cart once, on arrival at the confirmation page.
 *
 * Clearing here rather than in the checkout form ties it to the order actually being written: if
 * the action returns an error the customer keeps their cart and can retry. The ref guards against
 * React's development double-invoke and against a re-render clearing a cart the customer has since
 * started rebuilding in another tab.
 */
export function ClearCart() {
  const { clear } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    clear();
  }, [clear]);

  return null;
}
