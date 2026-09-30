"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics";

/**
 * Fires the Pixel/GA Purchase event once per order, when the page first shows it as paid.
 *
 * Rendered only for `paid` orders — never on arrival, since arriving here isn't proof of payment
 * (see page.tsx). The same order can be shown many times: PaymentPoll refreshes the page, and the
 * customer can reload or reopen the link from history. A per-order flag in localStorage keeps
 * that to one Purchase per browser; the Pixel's eventID dedupes anything that slips past it, e.g.
 * storage blocked in a private window.
 *
 * Deliberately sent without line items: this page renders only total and item count so that a
 * leaked link reveals as little as possible, and the client payload holds to the same rule.
 */
export function TrackPurchase({
  orderId,
  orderRef,
  value,
  itemCount,
}: {
  orderId: string;
  orderRef: string;
  value: number;
  itemCount: number;
}) {
  useEffect(() => {
    const key = `rr:purchase-tracked:${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — fall through and rely on eventID.
    }
    trackPurchase({ ref: orderRef, value, itemCount });
  }, [orderId, orderRef, value, itemCount]);

  return null;
}
