import type { QueueTone } from "@/components/admin/Queue";
import type { OrderStatus } from "@/lib/order-status";
import type { PaymentStatus } from "@/lib/payment-status";

/** Fulfillment status → badge tone. Its own module so the list and detail pages can't disagree. */
export function orderTone(status: OrderStatus): QueueTone {
  if (status === "new") return "new";
  if (status === "delivered") return "done";
  if (status === "cancelled") return "dead";
  return "active";
}

/**
 * Payment status → badge tone.
 *
 * `awaiting_payment` gets the in-progress tint rather than the solid "needs attention" fill: most
 * of them are abandoned checkouts, i.e. noise, and the solid fill is this codebase's signal that
 * something wants acting on right now.
 */
export function paymentTone(status: PaymentStatus): QueueTone {
  if (status === "paid") return "done";
  if (status === "failed") return "alert";
  if (status === "expired") return "dead";
  return "active";
}
