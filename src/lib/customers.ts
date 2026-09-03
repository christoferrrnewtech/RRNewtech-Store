/**
 * Customer profiles — SERVER ONLY.
 *
 * A customer's credentials live in Firebase Authentication (same project as the staff accounts);
 * this module owns everything else: the name, phone, PRC licence number, and the uploaded photo of
 * the licence card that a later step will OCR to verify the number automatically.
 *
 * Storage shape: one document per customer in `storeCustomers`, keyed by the Firebase Auth uid.
 * See COLLECTIONS in firebase.ts for why this is not the keyed-map document staff accounts use.
 *
 * PRIVACY: the PRC card photo is a government ID document, so the bucket object is NEVER made
 * world-readable and the Firestore document stores the object PATH, not a URL. Anything that needs
 * to display the image mints a short-lived signed URL through `prcIdImageUrl` at the moment of
 * viewing, so a leaked Firestore export doesn't hand out the images with it.
 */

import "server-only";
import crypto from "node:crypto";
import sharp from "sharp";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS, getBucket, storeCollection } from "@/lib/firebase";
import { MAX_PRC_IMAGE_BYTES, PRC_IMAGE_TYPES } from "@/lib/customer-fields";

/**
 * Where a customer's PRC licence stands. Every account starts `pending`; the planned OCR check (and
 * a human fallback in the admin) is what moves it on. Nothing gates on this yet — it is recorded now
 * so accounts created before the check exists don't have to be back-filled blind.
 */
export type PrcStatus = "pending" | "verified" | "rejected";

export type Customer = {
  /** Firebase Auth uid, and the Firestore document id. */
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Canonical 11-digit form, 09XXXXXXXXX. Format it for display with `formatPhone`. */
  phone: string;
  /** 6 or 7 digits, as printed on the card. */
  prcId: string;
  /** Storage object path for the licence photo — not a URL, and not publicly readable. */
  prcIdImagePath: string;
  prcStatus: PrcStatus;
  createdAt: string;
  updatedAt: string;
};

/** What a caller supplies to create a profile. The rest is stamped here. */
export type NewCustomer = Omit<Customer, "prcStatus" | "createdAt" | "updatedAt">;

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

function toCustomer(uid: string, v: Record<string, unknown>): Customer {
  return {
    uid,
    firstName: String(v.firstName ?? ""),
    lastName: String(v.lastName ?? ""),
    email: String(v.email ?? ""),
    phone: String(v.phone ?? ""),
    prcId: String(v.prcId ?? ""),
    prcIdImagePath: String(v.prcIdImagePath ?? ""),
    prcStatus:
      v.prcStatus === "verified" || v.prcStatus === "rejected" ? v.prcStatus : "pending",
    createdAt: toIso(v.createdAt),
    updatedAt: toIso(v.updatedAt),
  };
}

export function customerName(c: Pick<Customer, "firstName" | "lastName">): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomer(uid: string): Promise<Customer | null> {
  const snap = await storeCollection(COLLECTIONS.customers).doc(uid).get();
  return snap.exists ? toCustomer(snap.id, snap.data() ?? {}) : null;
}

/**
 * Whether a PRC number is already attached to another account.
 *
 * One licence, one account: the number identifies a specific practitioner, so two accounts sharing
 * it means at least one of them isn't who it claims to be. Not a uniqueness CONSTRAINT — Firestore
 * has none — so a simultaneous double sign-up could still slip through; the verification step is
 * what catches that, and this check is what stops the ordinary case.
 */
export async function prcIdTaken(prcId: string, exceptUid?: string): Promise<boolean> {
  const snap = await storeCollection(COLLECTIONS.customers)
    .where("prcId", "==", prcId)
    .limit(2)
    .get();
  return snap.docs.some((d) => d.id !== exceptUid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/** Create the profile document for a freshly created Firebase Auth user. */
export async function createCustomer(data: NewCustomer): Promise<Customer> {
  const { uid, ...rest } = data;
  const now = new Date().toISOString();
  await storeCollection(COLLECTIONS.customers)
    .doc(uid)
    .set({
      ...rest,
      prcStatus: "pending" satisfies PrcStatus,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  return { ...data, prcStatus: "pending", createdAt: now, updatedAt: now };
}

/** Remove a profile document. Used to unwind a half-finished sign-up. */
export async function deleteCustomer(uid: string): Promise<void> {
  await storeCollection(COLLECTIONS.customers).doc(uid).delete();
}

// ─────────────────────────────────────────────────────────────────────────────
// PRC licence photo
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ALLOWED = new Set<string>(PRC_IMAGE_TYPES);

/** 720p: the longest edge is capped here, whichever way up the card was photographed. */
const PRC_IMAGE_MAX_EDGE = 1280;

/**
 * Store the licence photo and return its object path.
 *
 * Re-encoded to WebP at 720p — a licence card fills most of the frame, so 1280px across still puts
 * roughly 40-60px of height on the ID digits, which is comfortably above what OCR needs to read
 * them. An 8 MB phone photo lands in Storage at a few tens of KB instead. `rotate()` bakes in EXIF
 * orientation so a photo taken in portrait isn't stored sideways, which would defeat OCR before it
 * started.
 *
 * The object carries no download token, so the only way to read it back is a signed URL or the
 * Admin SDK. Throws on a rejected file; the caller turns that into a form error.
 */
export async function uploadPrcIdImage(file: File, uid: string): Promise<string> {
  if (!TYPE_ALLOWED.has(file.type)) {
    throw new Error("Upload your PRC ID as a PNG, JPG or WebP image.");
  }
  if (file.size > MAX_PRC_IMAGE_BYTES) {
    throw new Error("The PRC ID image must be 8 MB or smaller.");
  }

  const compressed = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({
      width: PRC_IMAGE_MAX_EDGE,
      height: PRC_IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const path = `prc-ids/${uid}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await getBucket().file(path).save(compressed, {
    resumable: false,
    metadata: { contentType: "image/webp" },
  });
  return path;
}

export async function deletePrcIdImage(path: string): Promise<void> {
  if (!path) return;
  await getBucket().file(path).delete({ ignoreNotFound: true });
}

/** A read URL for a licence photo, valid for `minutes`. Mint one per view, never store it. */
export async function prcIdImageUrl(path: string, minutes = 10): Promise<string> {
  const [url] = await getBucket().file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + minutes * 60 * 1000,
  });
  return url;
}
