/**
 * Pull-based payment confirmation — SERVER ONLY.
 *
 * The webhook is the push path; this is the pull. When a customer lands back on the confirmation
 * page and their order still says `awaiting_payment`, we ask PayMongo directly rather than
 * waiting on a webhook that may be seconds behind, misconfigured, or — during local development —
 * unable to reach us at all.
 *
 * Three things this buys:
 *   1. Payment confirmation stops depending solely on a hand-registered webhook, which is the
 *      single most likely thing in this feature to be set up wrong.
 *   2. The whole flow becomes testable on localhost, where PayMongo cannot reach the machine.
 *   3. It is self-limiting: once an order is paid this never calls out again, so a leaked
 *      confirmation URL can't be used to hammer the gateway.
 *
 * Both paths funnel into the same `applyOrderPayment` transaction, so they cannot race into an
 * inconsistent state — whichever arrives second is a no-op.
 *
 * This lives here rather than in `orders.ts` so that module stays pure Firestore and never depends
 * on network I/O.
 */

import "server-only";
import { applyOrderPayment, getOrder, type Order } from "@/lib/orders";
import { getCheckoutSession, isPayMongoConfigured } from "@/lib/paymongo";

/**
 * Bring an order's payment state up to date with the gateway, and return the fresh order.
 *
 * Only `paid` is skipped, because only `paid` is terminal. It is tempting to skip everything but
 * `awaiting_payment`, and that was the original guard — but it is wrong now that `/checkout/pay`
 * writes `expired` when our one-hour window lapses. `expireCheckoutSession` is best-effort, so a
 * customer with a stale PayMongo tab can still pay a session we declared dead; if this bailed on
 * `expired`, that order would never be pull-reconciled again, and a misconfigured webhook (the
 * likeliest thing here to be set up wrong) would leave the confirmation page saying "payment
 * didn't go through" while the money had been taken. The same applies to `failed`, where the
 * customer retried on the same session.
 *
 * Skipping `paid` preserves the self-limiting property that matters: once an order is paid this
 * never calls out again, so a leaked confirmation URL can't be used to hammer the gateway.
 *
 * Network and gateway errors are swallowed on purpose: the caller is rendering a page for a
 * customer who has just paid, and the right answer to "PayMongo is briefly unreachable" is "still
 * confirming", not an error page. The webhook and the admin's re-check button remain as backstops.
 */
export async function reconcileOrderPayment(order: Order): Promise<Order> {
  if (order.paymentStatus === "paid") return order;
  if (!order.checkoutSessionId || !isPayMongoConfigured()) return order;

  try {
    const session = await getCheckoutSession(order.checkoutSessionId);
    if (!session) return order;

    // Cross-check: the session must be the one this order was sent to.
    if (session.id !== order.checkoutSessionId) return order;

    if (session.paymentStatus === "paid") {
      const changed = await applyOrderPayment(order.id, {
        paymentStatus: "paid",
        paidAt: session.paidAt,
        paymentMethod: session.paymentMethod,
      });
      if (changed) return (await getOrder(order.id)) ?? order;
    } else if (session.paymentStatus === "failed") {
      const changed = await applyOrderPayment(order.id, { paymentStatus: "failed" });
      if (changed) return (await getOrder(order.id)) ?? order;
    }
  } catch (err) {
    console.error("[payments] reconcile failed for order", order.id, err);
  }

  return order;
}
