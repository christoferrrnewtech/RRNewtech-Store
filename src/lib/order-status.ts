/**
 * Order status vocabulary — CLIENT-SAFE.
 *
 * Split out of `orders.ts` for the same reason `cart-item.ts` is split out of `cart.tsx`: that
 * module is `server-only` and pulls in firebase-admin, so a `"use client"` status dropdown
 * importing these values from it would drag the Admin SDK into the browser bundle and fail the
 * build. Types alone would be erased; the arrays and labels are real runtime values.
 */

import type { PaymentStatus } from "@/lib/payment-status";

/**
 * Fulfillment stages. Distinct from InquiryStatus on purpose — an order gets packed and shipped,
 * a sales inquiry gets quoted. One shared vocabulary would leave half the options inapplicable.
 */
export type OrderStatus = "new" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Can the customer cancel this order themselves, from /account?
 *
 * Only while it is unpaid and untouched by staff. A paid order means a refund, and a confirmed
 * one means someone has started on it; both go through sales rather than a button. Re-checked
 * inside the cancelling transaction (`cancelUnpaidOrder`), so this is also the server's rule.
 */
export function isCustomerCancellable(order: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}): boolean {
  return order.status === "new" && order.paymentStatus !== "paid";
}
