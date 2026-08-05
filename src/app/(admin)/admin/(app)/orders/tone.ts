import type { QueueTone } from "@/components/admin/Queue";
import type { OrderStatus } from "@/lib/order-status";

/** Fulfillment status → badge tone. Its own module so the list and detail pages can't disagree. */
export function orderTone(status: OrderStatus): QueueTone {
  if (status === "new") return "new";
  if (status === "delivered") return "done";
  if (status === "cancelled") return "dead";
  return "active";
}
