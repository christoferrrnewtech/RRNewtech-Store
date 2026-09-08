/**
 * Sales inquiries — SERVER ONLY.
 *
 * Everything sent through the contact form, including the "Contact a sales agent" path used by
 * products priced on request (`BrandProduct.contactSales`). Same storage shape and reasoning as
 * `orders.ts`: one document per record in its own collection.
 *
 * Kept separate from orders on purpose. An inquiry has no line items, no address and no
 * fulfillment — it is a conversation to be worked by sales, and its status vocabulary reflects that.
 */

import "server-only";
import { COLLECTIONS, storeCollection } from "@/lib/firebase";
import { makeRef } from "@/lib/reference";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/inquiry-status";

// See orders.ts — the vocabulary lives client-side so the admin's status dropdown can import it.
export { INQUIRY_STATUSES, INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/lib/inquiry-status";

/** The product being asked about, resolved server-side — never taken from the query string. */
export type InquiryProduct = {
  brandSlug: string;
  productSlug: string;
  name: string;
  href: string;
};

export type Inquiry = {
  id: string;
  ref: string;
  createdAt: number;
  status: InquiryStatus;
  name: string;
  email: string;
  phone: string;
  message: string;
  /** Absent when the visitor came to /contact directly rather than from a product. */
  product?: InquiryProduct;
  /**
   * Firebase Auth uid of the customer who sent this, when they were signed in.
   *
   * Absent for the guest path, which is the majority — anyone can use /contact. It exists because
   * email alone is a fragile link back to an account: a signed-in customer who types a second
   * address in the form (a clinic address, a typo) would otherwise never see their own inquiry on
   * /account. See `listInquiriesForCustomer`.
   */
  userId?: string;
  /** Internal note from staff. */
  note: string;
};

export type NewInquiry = Omit<Inquiry, "id" | "ref" | "createdAt" | "status" | "note">;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toInquiryStatus(value: unknown): InquiryStatus {
  return INQUIRY_STATUSES.includes(value as InquiryStatus) ? (value as InquiryStatus) : "new";
}

function toInquiry(id: string, value: Record<string, unknown>): Inquiry {
  const raw = value.product as Record<string, unknown> | undefined;
  const product: InquiryProduct | undefined =
    raw && typeof raw === "object"
      ? {
          brandSlug: str(raw.brandSlug),
          productSlug: str(raw.productSlug),
          name: str(raw.name),
          href: str(raw.href),
        }
      : undefined;

  return {
    id,
    ref: str(value.ref),
    createdAt: num(value.createdAt),
    status: toInquiryStatus(value.status),
    name: str(value.name),
    email: str(value.email),
    phone: str(value.phone),
    message: str(value.message),
    product,
    // Omitted rather than "" so the field's absence stays meaningful — a guest inquiry has no uid.
    ...(str(value.userId) ? { userId: str(value.userId) } : {}),
    note: str(value.note),
  };
}

export async function createInquiry(input: NewInquiry): Promise<{ id: string; ref: string }> {
  const ref = makeRef("INQ");
  const doc = await storeCollection(COLLECTIONS.inquiries).add({
    ...input,
    ref,
    createdAt: Date.now(),
    status: "new" satisfies InquiryStatus,
    note: "",
  });
  return { id: doc.id, ref };
}

export async function getInquiry(id: string): Promise<Inquiry | undefined> {
  const snap = await storeCollection(COLLECTIONS.inquiries).doc(id).get();
  if (!snap.exists) return undefined;
  return toInquiry(snap.id, snap.data() ?? {});
}

/** Newest first, capped. See the index note on `listOrders` — the same applies to a status filter. */
export async function listInquiries(options: {
  status?: InquiryStatus;
  limit?: number;
  before?: number;
} = {}): Promise<Inquiry[]> {
  const { status, limit = 50, before } = options;

  let query = storeCollection(COLLECTIONS.inquiries).orderBy("createdAt", "desc");
  if (status) query = query.where("status", "==", status);
  if (before) query = query.startAfter(before);

  const snap = await query.limit(limit).get();
  return snap.docs.map((d) => toInquiry(d.id, d.data() ?? {}));
}

/**
 * A signed-in customer's own inquiries, newest first.
 *
 * Matched on TWO keys, unioned, because either on its own loses records:
 *
 *   - `userId` catches anything sent while signed in, whatever address was typed into the form.
 *     This is the reliable link, but only inquiries created after it shipped carry one.
 *   - `email` catches the rest: everything sent before `userId` existed, plus anything the same
 *     person sent as a guest (signed out, or before they registered) using their account address.
 *
 * Two queries rather than one `Filter.or`, because a disjunction over two fields with an
 * `orderBy` needs its own index and returns the same documents anyway. Each side is capped at
 * `limit`, so the union is re-sorted and re-capped here.
 *
 * Needs the composite indexes storeInquiries(email ASC, createdAt DESC) and
 * storeInquiries(userId ASC, createdAt DESC).
 */
export async function listInquiriesForCustomer(
  customer: { uid?: string; email: string },
  limit = 20,
): Promise<Inquiry[]> {
  const needle = customer.email.trim().toLowerCase();
  const uid = (customer.uid ?? "").trim();
  if (!needle && !uid) return [];

  // Only the keys we actually have. A leg that was never run must not count as a success below.
  const legs: { field: "userId" | "email"; value: string }[] = [];
  if (uid) legs.push({ field: "userId", value: uid });
  if (needle) legs.push({ field: "email", value: needle });

  const settled = await Promise.allSettled(
    legs.map(async ({ field, value }) => {
      const snap = await storeCollection(COLLECTIONS.inquiries)
        .where(field, "==", value)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((d) => toInquiry(d.id, d.data() ?? {}));
    }),
  );

  // Settled, not awaited: the legs fail independently. The realistic failure is one of the indexes
  // above missing or still BUILDING — Firestore raises FAILED_PRECONDITION for both, with a
  // create-index URL in the message. Losing the uid leg to that must not also hide what the email
  // leg found, so a partial result is served and the reason is logged for whoever can deploy.
  for (const [i, result] of settled.entries()) {
    if (result.status === "rejected") {
      console.error(`[inquiries] the ${legs[i].field} query failed:`, result.reason);
    }
  }

  const ok = settled.filter((r) => r.status === "fulfilled");
  // Every leg we ran failed. Throw rather than return [], so the caller renders its "couldn't
  // load" state instead of an empty list that would read as "you have no inquiries".
  if (ok.length === 0) throw (settled[0] as PromiseRejectedResult).reason;

  // An inquiry sent while signed in with the account's own address matches both queries.
  const merged = new Map<string, Inquiry>();
  for (const result of ok) {
    for (const inquiry of result.value) merged.set(inquiry.id, inquiry);
  }

  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function countNewInquiries(): Promise<number> {
  const snap = await storeCollection(COLLECTIONS.inquiries)
    .where("status", "==", "new")
    .count()
    .get();
  return snap.data().count;
}

export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await storeCollection(COLLECTIONS.inquiries).doc(id).update({ status });
}

export async function setInquiryNote(id: string, note: string): Promise<void> {
  await storeCollection(COLLECTIONS.inquiries).doc(id).update({ note });
}
