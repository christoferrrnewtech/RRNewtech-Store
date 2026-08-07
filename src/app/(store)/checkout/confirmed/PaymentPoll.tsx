"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the confirmation page while payment is still being confirmed.
 *
 * The customer usually lands here a beat before the webhook does, and the page itself reconciles
 * against PayMongo on every render (see `reconcileOrderPayment`) — so a plain `router.refresh()`
 * is enough to resolve the state, with no extra endpoint to build or secure.
 *
 * Capped rather than indefinite: after ~20 seconds a payment that hasn't landed isn't going to be
 * fixed by more polling, and the page says so and gives the customer a reference to quote.
 */
const INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 10;

export function PaymentPoll() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, router]);

  if (attempts < MAX_ATTEMPTS) return null;

  return (
    <p className="mt-3 text-sm text-muted">
      This is taking longer than usual. Your payment may still go through — quote your reference
      above if you need to check with us.
    </p>
  );
}
