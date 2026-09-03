/**
 * Delivery addresses a customer has used — CLIENT-SAFE.
 *
 * There is no address book: nothing in the app stores a customer's addresses as editable records.
 * What exists is the `shipping` snapshot on every order, so "my addresses" is DERIVED from order
 * history rather than read from a table.
 *
 * That is a real limitation, not an oversight to be quietly papered over — a customer can't add an
 * address here before their first order, or edit one after. Turning this into a true address book
 * means a `storeCustomers/{uid}/addresses` subcollection and checkout writing to it; this module is
 * the read side that a change like that would replace.
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

/** Case- and whitespace-insensitive identity, so "Unit 5" and "unit 5 " are one address. */
function addressKey(s: OrderShipping): string {
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
    const key = addressKey(order.shipping);
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
