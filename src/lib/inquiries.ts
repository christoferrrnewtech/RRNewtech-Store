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
