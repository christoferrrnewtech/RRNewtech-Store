/**
 * Delivery addresses a customer has used — CLIENT-SAFE.
 *
 * The address book itself now lives in `customer-addresses.ts` (a `storeCustomers/{uid}/addresses`
 * subcollection, written by checkout and editable from /account). What remains here is the part
 * that has nothing to do with storage:
 *
 *   - `addressLines` / `shippingKey`, the display and identity rules, used by both sides
 *   - `deriveAddresses`, which reconstructs the distinct addresses a customer has ORDERED to from
 *     their order history — the only source for anyone who ordered before the book existed, and
 *     what /account offers to import from.
 *
 * No `server-only` import: the formatting is used by components on both sides.
 */

import type { OrderShipping } from "@/lib/order-shipping";

export type SavedAddress = {
  /** Stable key for React lists — the normalized address itself, so duplicates collapse. */
  key: string;
  shipping: OrderShipping;
  /** Epoch ms of the most recent order that used it. */
  lastUsedAt: number;
  /** How many orders were delivered here. */
  timesUsed: number;
};

/** The address as displayed, one line per row. Empty parts are dropped, never rendered blank. */
export function addressLines(s: OrderShipping): string[] {
  return [
    [s.address, s.apartment].filter(Boolean).join(", "),
    [s.barangay, s.city].filter(Boolean).join(", "),
    [s.region, s.postal].filter(Boolean).join(" "),
    s.country,
  ].filter(Boolean);
}

/**
 * Case- and whitespace-insensitive identity, so "Unit 5" and "unit 5 " are one address.
 *
 * Exported because the address book stores it: it is what stops a customer who checks out to the
 * same clinic every month from accumulating twelve copies of it. Built from `addressLines`, so two
 * addresses are the same exactly when they would PRINT the same on a waybill.
 */
export function shippingKey(s: OrderShipping): string {
  return addressLines(s).join(" | ").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Collapse an order list into the distinct addresses it used, most recently used first.
 *
 * Takes the minimum an order needs to contribute rather than a whole `Order`, so this module stays
 * free of the server-only orders module and can be unit-tested with plain objects.
 */
export function deriveAddresses(
  orders: { shipping: OrderShipping; createdAt: number }[],
): SavedAddress[] {
  const byKey = new Map<string, SavedAddress>();

  for (const order of orders) {
    const key = shippingKey(order.shipping);
    // An order with no address at all (an inquiry-style record, or a malformed document) has
    // nothing to show — skip rather than rendering an empty card.
    if (!key) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.timesUsed += 1;
      // Keep the snapshot from the most recent order: it reflects the latest spelling.
      if (order.createdAt > existing.lastUsedAt) {
        existing.lastUsedAt = order.createdAt;
        existing.shipping = order.shipping;
      }
    } else {
      byKey.set(key, {
        key,
        shipping: order.shipping,
        lastUsedAt: order.createdAt,
        timesUsed: 1,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}
