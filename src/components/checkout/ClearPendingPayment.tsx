"use client";

import { useEffect, useRef } from "react";
import { clearPendingPaymentCookie } from "@/lib/pay-window";

/**
 * Drops the pending-payment cookie once, when `when` first becomes true.
 *
 * A client component because a Server Component physically cannot delete a cookie — `cookies()`
 * during render is sealed read-only. That is one of the reasons the cookie is not httpOnly; see
 * `pay-window.ts`.
 *
 * Deliberately SEPARATE from `ClearCart` rather than a second flag on it, because the two
 * conditions genuinely differ: the cart must survive a failed or expired payment (a wiped cart
 * after a payment that didn't go through is lost revenue), whereas this pointer should be dropped
 * the moment the order stops being resumable. Folding them together would blur a comment that is
 * currently precise about exactly that distinction.
 *
 * The ref guards against React's development double-invoke, same as `ClearCart`.
 */
export function ClearPendingPayment({ when = true }: { when?: boolean }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !when) return;
    done.current = true;
    clearPendingPaymentCookie();
  }, [when]);

  return null;
}
