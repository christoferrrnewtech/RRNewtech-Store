/**
 * Shipping cost — CLIENT-SAFE.
 *
 * Everything the store knows about what shipping costs lives in this one file, because it is a
 * PLACEHOLDER. The real figure depends on destination and weight and will come from a courier
 * API; until that exists we charge a flat rate below the free-shipping threshold. Keeping it
 * behind `quoteShipping()` means swapping in a real quote later touches this module and nothing
 * else — the signature can grow to take the address and lines without any call site changing shape.
 *
 * Client-safe on purpose: the checkout summary panel and the server action must compute the SAME
 * number from the SAME code. A customer shown ₱150 and charged ₱200 is a support ticket.
 *
 * SECURITY: the fee is never posted from the browser. `placeOrderAction` derives it from the
 * REPRICED subtotal, after prices are re-read from Firestore. A hidden `shippingFee` input would
 * be a free discount for anyone who opens devtools.
 */

import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/** Flat nationwide rate charged below FREE_SHIPPING_THRESHOLD. Placeholder — see the header. */
export const FLAT_SHIPPING_FEE = 150;

/** Name and blurb for the shipping line item, used verbatim on PayMongo's hosted page. */
export const SHIPPING_LINE_NAME = "Shipping";
export const SHIPPING_LINE_DESCRIPTION = "Standard nationwide delivery";

/**
 * What to charge for delivery on an order of this size.
 *
 * A non-finite subtotal falls to the charged branch rather than the free one — if the number is
 * junk, err towards billing and letting a human notice, never towards giving delivery away.
 */
export function quoteShipping(subtotal: number): number {
  if (!Number.isFinite(subtotal)) return FLAT_SHIPPING_FEE;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
}
