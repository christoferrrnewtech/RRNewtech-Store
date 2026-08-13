"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPHP } from "@/lib/format";
import { minutesLeft, readPendingPaymentCookie, type PendingPayment } from "@/lib/pay-window";
import { PayWindowCountdown } from "./PayWindowCountdown";

/** Whole minutes on screen, so a per-second timer would be wasted work for the same string. */
const TICK_MS = 30_000;

/**
 * "You already have a payment waiting" — shown on /cart and /checkout.
 *
 * Two exports, one body. `/checkout` is already a dynamic route, so it reads the order server-side
 * and passes the authoritative figures in; `/cart` is prerendered to a static shell, so it uses
 * the cookie-reading wrapper below and stays static. Same wording either way, which is the point
 * of keeping them in one file.
 *
 * On /checkout this is the single most valuable placement in the feature: it is what stops a
 * customer who wandered off from filling the form again and creating a duplicate order. It is
 * deliberately persuasive but NOT blocking — the form stays fully usable underneath, because
 * someone who genuinely wants to change their order must be able to.
 */
export function PendingPaymentNotice({
  orderRef,
  expiresAt,
  total,
  retry = false,
}: {
  orderRef: string;
  expiresAt: number;
  /** Omitted on /cart, where only the cookie is available and it doesn't carry money. */
  total?: number;
  /** The previous attempt was declined — frame it as a retry rather than an interruption. */
  retry?: boolean;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-fg"
    >
      <p className="font-semibold">
        {retry ? "Your last payment didn't go through." : "You already have a payment waiting."}
      </p>
      <p className="mt-1 text-muted">
        Order{" "}
        <span className="font-[family-name:var(--font-display)] font-bold tracking-wide text-fg">
          {orderRef}
        </span>
        {typeof total === "number" && <> · {formatPHP(total)}</>} ·{" "}
        <PayWindowCountdown exp={expiresAt} fallback="Still valid for a short while." />
      </p>
      <p className="mt-1 text-muted">
        {retry
          ? "Nothing was charged. You can try again with a different method."
          : "Finishing that one avoids placing a duplicate order."}
      </p>
      <Link
        href="/checkout/pay"
        prefetch={false}
        className="mt-3 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {retry ? "Try that payment again" : "Continue that payment"}
      </Link>
    </div>
  );
}

/**
 * The same notice, driven by the cookie instead of server data.
 *
 * Renders nothing on the server and nothing on the first client render, then fills in from
 * `document.cookie` in an effect — the pattern `CartProvider` already documents for localStorage,
 * and what keeps a statically prerendered page static.
 *
 * It shows whatever the cookie says without checking the order, so it can briefly be stale (an
 * order paid in another tab). Harmless: clicking through lands on `/checkout/pay`, which
 * reconciles against PayMongo and redirects a paid order to the confirmation page.
 */
export function PendingPaymentNoticeFromCookie({ className }: { className?: string }) {
  const [pending, setPending] = useState<PendingPayment | null>(null);

  // The window check lives in here, not in render: `Date.now()` during render is impure, and it
  // would also go stale the moment it ran. Re-reading on a timer means the notice disappears on
  // its own when the hour lapses or another tab clears the cookie, rather than lingering on a page
  // left open.
  useEffect(() => {
    const read = () => {
      const next = readPendingPaymentCookie();
      setPending(next && minutesLeft(next.exp) > 0 ? next : null);
    };
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (!pending) return null;

  return (
    <div className={className}>
      <PendingPaymentNotice orderRef={pending.ref} expiresAt={pending.exp} />
    </div>
  );
}
