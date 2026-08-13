"use client";

import { useEffect, useState } from "react";
import { minutesLeft } from "@/lib/pay-window";

/**
 * "About 43 minutes left", refreshed while the page sits open.
 *
 * Renders `fallback` until mounted so the server and first client render match — the deadline is
 * absolute, but "minutes from now" is not, and rendering it during SSR would guarantee a hydration
 * mismatch as soon as a second ticked over.
 *
 * Thirty seconds, not one: the display is in whole minutes, so a per-second timer would be pure
 * wasted work for an identical string.
 */
const TICK_MS = 30_000;

export function PayWindowCountdown({
  exp,
  fallback = null,
  onExpired,
}: {
  exp: number;
  fallback?: React.ReactNode;
  /** Fired once when the window closes — the pay page uses it to re-render into the real state. */
  onExpired?: () => void;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(minutesLeft(exp));
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [exp]);

  useEffect(() => {
    if (left === 0) onExpired?.();
  }, [left, onExpired]);

  if (left === null) return <>{fallback}</>;
  if (left === 0) return <>This payment link has expired.</>;
  return (
    <>
      About {left} minute{left === 1 ? "" : "s"} left to pay.
    </>
  );
}
