/**
 * Who pays for delivery — CLIENT-SAFE.
 *
 * What delivery COSTS is no longer decided here: it comes from JRS Express, quoted against the
 * buyer's city/province and the box the cart actually forms (see `jrs.ts` and `jrs-packaging.ts`).
 * This module is only the store's pricing policy on top of that figure, which is a single rule —
 * we absorb the courier's charge once the order is big enough.
 *
 * Client-safe on purpose: the checkout summary panel and the server action must apply the SAME
 * policy to the SAME quote. A customer shown "Free" and charged ₱240 is a support ticket.
 *
 * SECURITY: neither the fee nor the quote is ever posted from the browser. `placeOrderAction`
 * re-quotes JRS server-side from the REPRICED subtotal and the address on the submitted form; the
 * figure the panel displayed is advisory. A hidden `shippingFee` input would be a free discount for
 * anyone who opens devtools.
 */

import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/** Name and blurb for the shipping line item, used verbatim on PayMongo's hosted page. */
export const SHIPPING_LINE_NAME = "Shipping";
export const SHIPPING_LINE_DESCRIPTION = "Nationwide delivery via JRS Express";

/**
 * What to CHARGE the customer, given what JRS quoted.
 *
 * The store eats the courier's fee at and above the free-shipping threshold. The quote itself is
 * still taken and still stored on the order (`jrsShipment.shippingCost`) — the business needs to
 * know what it paid, and the shipment still has to be booked at that rate.
 *
 * A non-finite quote THROWS rather than defaulting. There is no longer a safe flat number to fall
 * back to, and silently charging 0 for a real delivery is the expensive failure; refusing the
 * checkout is the cheap one.
 */
export function chargeForShipping(jrsCost: number, subtotal: number): number {
  if (!Number.isFinite(jrsCost) || jrsCost < 0) {
    throw new Error(`Refusing to charge a non-finite shipping cost: ${jrsCost}`);
  }
  if (!Number.isFinite(subtotal)) {
    throw new Error(`Refusing to price shipping against a non-finite subtotal: ${subtotal}`);
  }
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : jrsCost;
}
