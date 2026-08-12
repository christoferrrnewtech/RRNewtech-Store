import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isPayMongoConfigured } from "@/lib/paymongo";
import { getOrder } from "@/lib/orders";
import { isPayWindowOpen, PAY_COOKIE, parsePendingPayment } from "@/lib/pay-window";
import { getProvinces } from "@/lib/locations";
import { CheckoutClient, type PendingCheckout } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  // A per-customer cart step — never index it.
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout" },
};

/**
 * Reading `?payment=cancelled` here rather than with `useSearchParams()` in the client keeps the
 * whole page out of the Suspense-boundary dance that hook requires — and `isPayMongoConfigured()`
 * is `server-only`, so this is the right side of the boundary to call it on. Passing a plain
 * boolean down means an unconfigured deploy shows the manual-order wording up front instead of
 * surprising the customer at submit time.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = await searchParams;

  return (
    <CheckoutClient
      paymentsEnabled={isPayMongoConfigured()}
      cancelled={payment === "cancelled"}
      pending={await pendingCheckout()}
      // Rendered in, not fetched: 82 names is nothing to send, and it means the first dropdown is
      // usable on first paint rather than after a round-trip. Cities and barangays still come from
      // Server Actions — 42,000 barangays have no business in a page payload.
      provinces={getProvinces()}
    />
  );
}

/**
 * The resume notice's data, read server-side.
 *
 * This page is already dynamic (it awaits `searchParams`), so reading the cookie here costs no
 * static generation — and it buys the authoritative version: the real reference, the real total,
 * the real deadline, and correct suppression if the order turned out to be already paid. That is
 * strictly better than the cookie-derived guess `/cart` has to settle for.
 *
 * Deliberately no `reconcileOrderPayment` — that is a gateway round trip on a page customers
 * reload, and a notice one webhook-beat stale is harmless: clicking through lands on
 * `/checkout/pay`, which does reconcile and redirects a paid order onward. So this costs a single
 * Firestore read, and only when the cookie is present at all.
 */
async function pendingCheckout(): Promise<PendingCheckout | null> {
  const cookie = parsePendingPayment((await cookies()).get(PAY_COOKIE)?.value);
  if (!cookie) return null;

  const order = await getOrder(cookie.orderId).catch(() => undefined);
  if (!order || !order.checkoutUrl) return null;
  if (order.paymentStatus !== "awaiting_payment" && order.paymentStatus !== "failed") return null;
  if (!isPayWindowOpen(order.checkoutExpiresAt)) return null;

  return {
    ref: order.ref,
    total: order.total,
    expiresAt: order.checkoutExpiresAt,
    retry: order.paymentStatus === "failed",
  };
}
