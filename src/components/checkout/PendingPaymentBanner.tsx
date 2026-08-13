"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { minutesLeft, readPendingPaymentCookie, type PendingPayment } from "@/lib/pay-window";

/**
 * Site-wide "you have a payment waiting" strip, so a customer who wandered off mid-checkout can
 * find their way back from anywhere on the store.
 *
 * A CLIENT component reading `document.cookie`, not a server one reading `cookies()`. That is the
 * whole reason the pending-payment cookie isn't httpOnly: this mounts in the storefront layout,
 * which wraps every page, and one `cookies()` call there would turn ~130 prerendered routes
 * dynamic — every product and brand page becoming an origin hit with a Firestore round trip for
 * the header menus. See `pay-window.ts` for why that costs no security.
 *
 * No hydration mismatch by construction: the server renders nothing, the first client render also
 * renders nothing (initial state is null), and the effect fills it in afterwards. Same pattern
 * `CartProvider` documents for localStorage.
 */
const TICK_MS = 30_000;

export function PendingPaymentBanner() {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // `pathname` in the deps is load-bearing. The layout survives App Router navigations, so a bare
  // `[]` would read the cookie once and go permanently stale — the banner would keep advertising a
  // payment long after /checkout/confirmed cleared it.
  useEffect(() => {
    const read = () => {
      const next = readPendingPaymentCookie();
      // Re-reading on every tick also picks up a clear from another tab.
      setPending(next && minutesLeft(next.exp) > 0 ? next : null);
    };
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [pathname]);

  // Those surfaces carry their own richer notice, and on /checkout/pay itself it's just noise.
  const suppressed = pathname === "/cart" || pathname.startsWith("/checkout");
  if (!pending || dismissed || suppressed) return null;

  const left = minutesLeft(pending.exp);

  return (
    <div role="status" className="bg-accent text-white">
      <Container className="flex items-center justify-center gap-3 py-2 text-xs font-medium">
        <span className="min-w-0 truncate">
          Payment waiting for{" "}
          <span className="font-[family-name:var(--font-display)] font-bold tracking-wide">
            {pending.ref}
          </span>{" "}
          · {left} min left
        </span>
        <Link
          href="/checkout/pay"
          prefetch={false}
          className="shrink-0 rounded-full bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"
        >
          Finish payment →
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-white/70 hover:text-white"
        >
          ✕
        </button>
      </Container>
    </div>
  );
}
