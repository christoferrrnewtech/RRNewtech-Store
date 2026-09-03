/**
 * Customer orders — SERVER ONLY.
 *
 * Orders live in their own top-level collection, one document per order (see COLLECTIONS in
 * `firebase.ts` for why they don't use the keyed-map-in-one-document shape the CMS content uses).
 * That lets Firestore do the ordering, status filtering and paging instead of us loading
 * everything into memory, which matters for a set that only ever grows.
 *
 * Written from the storefront checkout action, read and worked from /admin/orders. The order
 * document is created BEFORE the customer is sent to PayMongo, as `awaiting_payment`, so an
 * abandoned checkout never loses what the customer typed and every payment is reconcilable
 * against a real record. `applyOrderPayment` is the only thing that moves it to paid.
 *
 * The confirmation page reads an order by document id (see checkout/confirmed/page.tsx); nothing
 * else on the storefront renders orders, so writes never revalidate a public path.
 */

import "server-only";
import { COLLECTIONS, getDb, storeCollection } from "@/lib/firebase";
import { makeRef } from "@/lib/reference";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/payment-status";
import { PAY_WINDOW_MS } from "@/lib/pay-window";
import type { CartItemSource } from "@/lib/cart-item";
import type { OrderShipping } from "@/lib/order-shipping";

// The status vocabularies live in the client-safe `order-status.ts` / `payment-status.ts` — the
// admin's dropdowns and filter chips need those values, and this module can't cross the client
// boundary.
export { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
export { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/payment-status";
export type { OrderShipping } from "@/lib/order-shipping";

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

  // ── Payment ────────────────────────────────────────────────────────────────
  // Independent of `status` above: that is fulfillment, this is where the money is.

  /** Where the money is. Only `applyOrderPayment` may change it. */
  paymentStatus: PaymentStatus;
  /**
   * What delivery cost the CUSTOMER on this order — a SNAPSHOT taken at the moment of ordering,
   * never recomputed. Rates change; an old order must keep what it charged. 0 whenever the
   * free-shipping threshold applied.
   */
  shippingFee: number;
  /** subtotal + shippingFee. The figure actually charged, and what PayMongo's line items sum to. */
  total: number;
  /** PayMongo checkout session id ("cs_…"); "" for orders recorded without the gateway. */
  checkoutSessionId: string;
  /** The hosted payment page. Staff can re-send it to a customer while the order is unpaid. */
  checkoutUrl: string;
  /**
   * Epoch ms after which the session is treated as dead and the customer must place a new order
   * (which reprices against the catalog). Stamped at creation, never extended.
   *
   * Stored on the ORDER rather than only in the resume cookie because that cookie is
   * client-controlled and disposable — a customer who cleared cookies would otherwise own a
   * payment link that never expires. It is also what the admin reads to warn staff that a link has
   * lapsed, and what a future sweep job would query.
   *
   * 0 on any order written before the payment window existed — read as "no window", never expires.
   */
  checkoutExpiresAt: number;
  /** Epoch ms of confirmed payment; 0 while unpaid. */
  paidAt: number;
  /** "gcash" | "card" | "manual" | "". `manual` means staff recorded an off-platform payment. */
  paymentMethod: string;
  /** Last gateway error, capped. The only way staff can diagnose an order stuck unpaid. */
  paymentError: string;
};

/**
 * Everything the checkout action supplies; the rest is generated here.
 *
 * Checkout knows the money (it repriced the cart and quoted shipping) but not the payment state —
 * that only exists once a session has been created and the gateway has reported back.
 */
export type NewOrder = Omit<
  Order,
  | "id"
  | "ref"
  | "createdAt"
  | "status"
  | "note"
  | "paymentStatus"
  | "checkoutSessionId"
  | "checkoutUrl"
  // The payment window is store policy, not something the caller gets to choose.
  | "checkoutExpiresAt"
  | "paidAt"
  | "paymentMethod"
  | "paymentError"
>;

function toOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "new";
}

/**
 * An order written before payments existed has no `paymentStatus`. It defaults to
 * `awaiting_payment`, which is the honest reading of "no online payment was collected" — but note
 * that also hides it from the admin's paid-by-default view. `scripts/backfill-order-payments.ts`
 * stamps legacy documents as manually paid; run it once before deploying this.
 */
function toPaymentStatus(value: unknown): PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : "awaiting_payment";
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
    paymentStatus: toPaymentStatus(value.paymentStatus),
    shippingFee: num(value.shippingFee),
    // A legacy order has no `total`; its subtotal was the whole figure.
    total: num(value.total) || num(value.subtotal),
    checkoutSessionId: str(value.checkoutSessionId),
    checkoutUrl: str(value.checkoutUrl),
    // 0 for an order predating the payment window — `isPayWindowOpen` reads that as "never
    // expires", so no backfill is needed and a deploy can't retroactively kill old orders.
    checkoutExpiresAt: num(value.checkoutExpiresAt),
    paidAt: num(value.paidAt),
    paymentMethod: str(value.paymentMethod),
    paymentError: str(value.paymentError),
  };
}

/**
 * Create an order. Returns the id and generated reference — the id is what links the order to a
 * PayMongo session, the ref is what the customer quotes back to us.
 *
 * The payment fields are written as explicit ""/0 rather than left undefined: `getDb()` runs with
 * `ignoreUndefinedProperties: true`, which would silently omit them, and a MISSING field never
 * matches a Firestore equality filter — so the admin's `paymentStatus == "awaiting_payment"` query
 * would skip exactly the orders it exists to find.
 */
export async function createOrder(
  input: NewOrder,
): Promise<{ id: string; ref: string; checkoutExpiresAt: number }> {
  const ref = makeRef("RR");
  // One clock read for both timestamps, so they are exactly PAY_WINDOW_MS apart. Returning the
  // deadline rather than letting the caller recompute it keeps that guarantee — a second
  // `Date.now()` in the action would drift by however long the write took.
  const now = Date.now();
  const checkoutExpiresAt = now + PAY_WINDOW_MS;

  const doc = await storeCollection(COLLECTIONS.orders).add({
    ...input,
    ref,
    createdAt: now,
    status: "new" satisfies OrderStatus,
    note: "",
    paymentStatus: "awaiting_payment" satisfies PaymentStatus,
    checkoutSessionId: "",
    checkoutUrl: "",
    checkoutExpiresAt,
    paidAt: 0,
    paymentMethod: "",
    paymentError: "",
  });
  return { id: doc.id, ref, checkoutExpiresAt };
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const snap = await storeCollection(COLLECTIONS.orders).doc(id).get();
  if (!snap.exists) return undefined;
  return toOrder(snap.id, snap.data() ?? {});
}

/** Find the order a PayMongo webhook is talking about. Single-field index — auto-created. */
export async function getOrderByCheckoutSessionId(
  checkoutSessionId: string,
): Promise<Order | undefined> {
  if (!checkoutSessionId) return undefined;
  const snap = await storeCollection(COLLECTIONS.orders)
    .where("checkoutSessionId", "==", checkoutSessionId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? toOrder(doc.id, doc.data() ?? {}) : undefined;
}

/**
 * Newest first, capped. `before` is the `createdAt` of the last row already shown — the cursor the
 * admin's "Show older" link carries, so paging doesn't need offsets.
 *
 * NOTE: filtering while ordering by createdAt needs a composite index. Firestore returns an error
 * containing a one-click creation link the first time each filtered query runs; the unfiltered
 * list works without any:
 *
 *   status                  → status ASC, createdAt DESC
 *   paymentStatus           → paymentStatus ASC, createdAt DESC
 *   both                    → status ASC, paymentStatus ASC, createdAt DESC
 *   countNewOrders()        → status ASC, paymentStatus ASC
 *
 * Nothing queries `checkoutExpiresAt` today. A scheduled sweep that expires abandoned checkouts
 * would want paymentStatus ASC, checkoutExpiresAt ASC — noted here so it isn't a surprise.
 *
 * Both filters are equality-only on purpose. Expressing "anything but awaiting_payment" with `!=`
 * would force Firestore to order by the inequality field first, destroying the `createdAt DESC`
 * ordering this whole queue and its cursor pager depend on.
 */
export async function listOrders(options: {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
  before?: number;
} = {}): Promise<Order[]> {
  const { status, paymentStatus, limit = 50, before } = options;

  let query = storeCollection(COLLECTIONS.orders).orderBy("createdAt", "desc");
  if (status) query = query.where("status", "==", status);
  if (paymentStatus) query = query.where("paymentStatus", "==", paymentStatus);
  if (before) query = query.startAfter(before);

  const snap = await query.limit(limit).get();
  return snap.docs.map((d) => toOrder(d.id, d.data() ?? {}));
}

/**
 * A signed-in customer's own orders, newest first.
 *
 * Matched on `customer.email`, not a uid: orders are written by an anonymous checkout that has no
 * account attached, so email is the only link that exists — and it has the useful property of
 * covering orders placed BEFORE the customer ever registered.
 *
 * That is only sound because the address is PROVEN. A customer cannot sign in until Firebase has
 * confirmed the mailbox (see loginCustomerAction), so "same email" really does mean "same person".
 * If email verification is ever relaxed, this becomes an account-takeover path and must move to a
 * uid stamped on the order at checkout.
 *
 * Needs the composite index storeOrders(customer.email ASC, createdAt DESC) — see
 * firestore.indexes.json. Firestore fails the query rather than scanning without it.
 */
export async function listOrdersForCustomer(email: string, limit = 20): Promise<Order[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];

  const snap = await storeCollection(COLLECTIONS.orders)
    .where("customer.email", "==", needle)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => toOrder(d.id, d.data() ?? {}));
}

/**
 * How many orders still need attention — drives the sidebar badge.
 *
 * Narrowed to PAID orders deliberately. An abandoned checkout still writes a `status: "new"`
 * document, so counting status alone would inflate the badge with carts nobody ever paid for.
 */
export async function countNewOrders(): Promise<number> {
  const snap = await storeCollection(COLLECTIONS.orders)
    .where("status", "==", "new")
    .where("paymentStatus", "==", "paid" satisfies PaymentStatus)
    .count()
    .get();
  return snap.data().count;
}

/** Drives the count shown on the admin's "Awaiting payment" filter chip. */
export async function countOrdersByPayment(paymentStatus: PaymentStatus): Promise<number> {
  const snap = await storeCollection(COLLECTIONS.orders)
    .where("paymentStatus", "==", paymentStatus)
    .count()
    .get();
  return snap.data().count;
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ status });
}

export async function setOrderNote(id: string, note: string): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ note });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment
// ─────────────────────────────────────────────────────────────────────────────

/** Records the session a customer was sent to pay at, right after it is created. */
export async function setOrderCheckoutSession(
  id: string,
  checkoutSessionId: string,
  checkoutUrl: string,
): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ checkoutSessionId, checkoutUrl });
}

/** Why the gateway refused to start a payment. Capped — it's an external string. */
export async function setOrderPaymentError(id: string, message: string): Promise<void> {
  await storeCollection(COLLECTIONS.orders).doc(id).update({ paymentError: message.slice(0, 300) });
}

/**
 * Move an order's payment state. THE correctness guarantee of the whole payment path.
 *
 * Transactional and MONOTONIC:
 *
 *   awaiting_payment → paid      ✔  the happy path
 *   failed           → paid      ✔  the customer retried on the same session
 *   awaiting_payment → failed    ✔  declined card
 *   paid             → paid      ✖  no-op, returns false — IDEMPOTENCY
 *   paid             → failed    ✖  ignored: a later failed attempt must never un-pay an order
 *   paid             → expired   ✖  ignored, same reason
 *
 * Because `paid` is terminal against everything, webhook redelivery, out-of-order events, and the
 * webhook racing the reconcile-on-read path are all automatically safe — no coordination needed
 * between them, they just both call this.
 *
 * Returns true only when something actually changed, so callers know whether to revalidate.
 *
 * This and nothing else may write `paymentStatus`. The admin's manual "mark as paid" goes through
 * here too, precisely so it obeys the same rules.
 */
export async function applyOrderPayment(
  id: string,
  next: { paymentStatus: "paid" | "failed" | "expired"; paidAt?: number; paymentMethod?: string },
): Promise<boolean> {
  const ref = storeCollection(COLLECTIONS.orders).doc(id);

  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;

    const current = toPaymentStatus((snap.data() ?? {}).paymentStatus);
    if (current === "paid") return false; // terminal — nothing may follow it
    if (current === next.paymentStatus) return false;

    tx.update(ref, {
      paymentStatus: next.paymentStatus,
      paidAt: next.paymentStatus === "paid" ? next.paidAt || Date.now() : 0,
      paymentMethod: next.paymentMethod ?? "",
      // A successful payment clears whatever went wrong on the previous attempt.
      ...(next.paymentStatus === "paid" ? { paymentError: "" } : {}),
    });
    return true;
  });
}
