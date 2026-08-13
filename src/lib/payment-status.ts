/**
 * Payment status vocabulary — CLIENT-SAFE.
 *
 * Split out of `orders.ts` for exactly the reason `order-status.ts` is: that module is
 * `server-only` and pulls in firebase-admin, so a `"use client"` admin filter importing these
 * values from it would drag the Admin SDK into the browser bundle and fail the build.
 *
 * Deliberately SEPARATE from OrderStatus. `status` is fulfillment (packed, shipped, delivered);
 * this is where the money is. They move independently — a paid order still needs packing, and a
 * cancelled order may already have been paid and need refunding.
 */

/**
 * Every transition goes through `applyOrderPayment` in orders.ts — that is the invariant, and it
 * holds no matter how many callers there are. Today they are: the PayMongo webhook, the
 * reconcile-on-read path, `/checkout/pay`'s lazy expiry, and the admin's manual "mark as paid".
 * Nothing writes this field directly.
 */
export type PaymentStatus = "awaiting_payment" | "paid" | "failed" | "expired";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "awaiting_payment",
  "paid",
  "failed",
  "expired",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  expired: "Expired",
};

/**
 * Why the list stops here:
 *
 * No `refunded` — refunds happen in PayMongo's dashboard and we subscribe to no refund event, so
 * the value would always be stale. Adding it means a `payment.refunded` webhook handler too.
 *
 * No `paid_manual` — an order paid by bank transfer is `paid` with `paymentMethod: "manual"`.
 * That keeps "is this order paid?" a single-field question, which is what every query, badge and
 * index wants; provenance lives in `paymentMethod` plus an audit line in the order's note.
 *
 * `expired` means OUR one-hour payment window lapsed — see `pay-window.ts`. It is set lazily by
 * `/checkout/pay` when a customer returns after the deadline, and by staff cancelling an order.
 * PayMongo emits no session-expiry event of its own, so nothing catches a customer who never comes
 * back; a scheduled sweep would, and because `checkoutExpiresAt` is stored on the order that stays
 * a query rather than a data migration.
 *
 * `expired` is NOT terminal. `expired → paid` is legal in `applyOrderPayment`, because
 * `expireCheckoutSession` is best-effort and a customer with a stale PayMongo tab can still pay a
 * session we failed to kill. Losing that payment would be far worse than a surprising transition.
 */
