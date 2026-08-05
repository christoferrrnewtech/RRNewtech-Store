/**
 * Customer orders — SERVER ONLY.
 *
 * Orders live in their own top-level collection, one document per order (see COLLECTIONS in
 * `firebase.ts` for why they don't use the keyed-map-in-one-document shape the CMS content uses).
 * That lets Firestore do the ordering, status filtering and paging instead of us loading
 * everything into memory, which matters for a set that only ever grows.
 *
 * Written from the storefront checkout action, read and worked from /admin/orders. Nothing here
 * renders on the storefront, so writes never revalidate a public path.
 */

import "server-only";
import { COLLECTIONS, storeCollection } from "@/lib/firebase";
import { makeRef } from "@/lib/reference";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import type { CartItemSource } from "@/lib/cart-item";

// The status vocabulary lives in the client-safe `order-status.ts` — the admin's status dropdown
// needs those values, and this module can't cross the client boundary.
export { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export type OrderLine = {
  source: CartItemSource;
  /** Natural id within the source: catalog `Product.slug`, or `BrandProduct.id`. */
  id: string;
  name: string;
  sku: string;
  href: string;
  image: string;
  /** Unit label ("box", "pc"); "" for brand products, which have none. */
  unit: string;
  quantity: number;
  /** Unit price re-read from the catalog server-side — never the figure the browser posted. */
  price: number;
  lineTotal: number;
};

export type OrderCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type OrderShipping = {
  address: string;
  apartment: string;
  barangay: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type Order = {
  /** Firestore document id — the real key. */
  id: string;
  /** Human-readable code shown to the customer and quoted back to us, e.g. "RR-8F3K2M". */
  ref: string;
  /** Epoch ms. Stored as a number so it sorts and paginates without Timestamp coercion. */
  createdAt: number;
  status: OrderStatus;
  customer: OrderCustomer;
  shipping: OrderShipping;
  lines: OrderLine[];
  /** Sum of lineTotals, computed server-side from re-read prices. */
  subtotal: number;
  itemCount: number;
  /** Internal note from staff — never shown to the customer. */
  note: string;
};

/** Everything the checkout action supplies; the rest is generated here. */
export type NewOrder = Omit<Order, "id" | "ref" | "createdAt" | "status" | "note">;

function toOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "new";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOrderLine(value: unknown): OrderLine {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    source: v.source === "brand" ? "brand" : "catalog",
    id: str(v.id),
    name: str(v.name),
    sku: str(v.sku),
    href: str(v.href),
    image: str(v.image),
    unit: str(v.unit),
    quantity: num(v.quantity),
    price: num(v.price),
    lineTotal: num(v.lineTotal),
  };
}

/** Coerce a raw document defensively — a stored order outlives any given deploy. */
function toOrder(id: string, value: Record<string, unknown>): Order {
  const customer = (value.customer ?? {}) as Record<string, unknown>;
  const shipping = (value.shipping ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(value.lines) ? value.lines.map(toOrderLine) : [];

  return {
    id,
    ref: str(value.ref),
    createdAt: num(value.createdAt),
    status: toOrderStatus(value.status),
    customer: {
      firstName: str(customer.firstName),
      lastName: str(customer.lastName),
      email: str(customer.email),
      phone: str(customer.phone),
    },
    shipping: {
      address: str(shipping.address),
      apartment: str(shipping.apartment),
      barangay: str(shipping.barangay),
      city: str(shipping.city),
      region: str(shipping.region),
      postal: str(shipping.postal),
      country: str(shipping.country),
    },
    lines,
    subtotal: num(value.subtotal),
    itemCount: num(value.itemCount),
    note: str(value.note),
  };
}

/** Create an order. Returns the generated reference so checkout can show it to the customer. */
export async function createOrder(input: NewOrder): Promise<{ id: string; ref: string }> {
  const ref = makeRef("RR");
  const doc = await storeCollection(COLLECTIONS.orders).add({
    ...input,
    ref,
    createdAt: Date.now(),
    status: "new" satisfies OrderStatus,
    note: "",
  });
  return { id: doc.id, ref };
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const snap = await storeCollection(COLLECTIONS.orders).doc(id).get();
  if (!snap.exists) return undefined;
  return toOrder(snap.id, snap.data() ?? {});
}

/**
 * Newest first, capped. `before` is the `createdAt` of the last row already shown — the cursor the
 * admin's "Show older" link carries, so paging doesn't need offsets.
 *
 * NOTE: filtering by status while ordering by createdAt needs a composite index
 * (status ASC, createdAt DESC). Firestore returns an error containing a one-click creation link
 * the first time a filtered query runs; the unfiltered list works without it.
 */
export async function listOrders(options: {
  status?: OrderStatus;
  limit?: number;
  before?: number;
} = {}): Promise<Order[]> {
  const { status, limit = 50, before } = options;

  let query = storeCollection(COLLECTIONS.orders).orderBy("createdAt", "desc");
  if (status) query = query.where("status", "==", status);
  if (before) query = query.startAfter(before);

  const snap = await query.limit(limit).get();
  return snap.docs.map((d) => toOrder(d.id, d.data() ?? {}));
}

/** How many orders still need attention — drives the sidebar badge. */
export async function countNewOrders(): Promise<number> {
  const snap = await storeCollection(COLLECTIONS.orders).where("status", "==", "new").count().get();
  return snap.data().count;
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ status });
}

export async function setOrderNote(id: string, note: string): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ note });
}
