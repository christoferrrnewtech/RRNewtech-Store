/**
 * A customer's address book — SERVER ONLY.
 *
 * Storage shape: a `addresses` SUBCOLLECTION under the customer's own document, i.e.
 * `storeCustomers/{uid}/addresses/{addressId}`. A subcollection rather than an array field on the
 * profile, because a card can then be written or deleted on its own without read-modify-writing
 * the whole profile — two tabs editing different addresses would otherwise clobber each other.
 *
 * Being under the customer document is also what makes the read cheap and the isolation obvious:
 * there is no `uid` field to filter on and therefore no way to accidentally query across
 * customers, and deleting a customer's addresses means deleting their subcollection.
 *
 * NO COMPOSITE INDEX. The list is read whole (capped at MAX_ADDRESSES) and ordered in memory —
 * a customer has a handful of addresses, not a feed, and sorting by "default first, then most
 * recently touched" in Firestore would need an index for a query that returns at most a dozen
 * documents.
 *
 * The address a customer types at checkout is remembered here automatically
 * (`rememberOrderAddress`), so the book fills itself for anyone who is signed in.
 */

import "server-only";
import { COLLECTIONS, getDb, storeCollection } from "@/lib/firebase";
import { shippingKey } from "@/lib/addresses";
import { toAddressLabel } from "@/lib/address-book";
import type { CustomerAddress, NewCustomerAddress } from "@/lib/address-book";
import type { OrderShipping } from "@/lib/order-shipping";

// The record shape and its label vocabulary live client-side so the checkout picker and the
// account address form can speak them — see address-book.ts.
export {
  ADDRESS_LABELS,
  ADDRESS_LABEL_NAMES,
  type AddressLabel,
  type CustomerAddress,
  type NewCustomerAddress,
} from "@/lib/address-book";

/**
 * How many a customer may keep.
 *
 * A ceiling rather than a policy: checkout writes here on every order, so without one a clinic
 * that ships to a different site weekly would grow this list without bound. Twelve is far more
 * than anyone manages by hand, and the oldest non-default is evicted to make room.
 */
export const MAX_ADDRESSES = 12;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addresses(uid: string) {
  return storeCollection(COLLECTIONS.customers).doc(uid).collection("addresses");
}

function toAddress(id: string, value: Record<string, unknown>): CustomerAddress {
  const shipping = (value.shipping ?? {}) as Record<string, unknown>;
  return {
    id,
    label: toAddressLabel(value.label),
    firstName: str(value.firstName),
    lastName: str(value.lastName),
    phone: str(value.phone),
    shipping: {
      address: str(shipping.address),
      apartment: str(shipping.apartment),
      barangay: str(shipping.barangay),
      city: str(shipping.city),
      region: str(shipping.region),
      postal: str(shipping.postal),
      country: str(shipping.country) || "Philippines",
    },
    isDefault: value.isDefault === true,
    key: str(value.key),
    createdAt: num(value.createdAt),
    updatedAt: num(value.updatedAt),
  };
}

/** Default first, then most recently touched — the order every screen shows them in. */
function ordered(list: CustomerAddress[]): CustomerAddress[] {
  return [...list].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function listCustomerAddresses(uid: string): Promise<CustomerAddress[]> {
  if (!uid) return [];
  const snap = await addresses(uid).limit(MAX_ADDRESSES + 1).get();
  return ordered(snap.docs.map((d) => toAddress(d.id, d.data() ?? {})));
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make `id` the only default, in one atomic batch.
 *
 * A batch rather than two writes: a crash between "clear the old" and "set the new" would leave a
 * customer with no default at all, and checkout would then silently preselect nothing.
 */
async function applyDefault(uid: string, id: string, existing: CustomerAddress[]): Promise<void> {
  const batch = getDb().batch();
  for (const address of existing) {
    if (address.id !== id && address.isDefault) {
      batch.update(addresses(uid).doc(address.id), { isDefault: false });
    }
  }
  batch.update(addresses(uid).doc(id), { isDefault: true, updatedAt: Date.now() });
  await batch.commit();
}

/**
 * Create an address, or overwrite the one at `id`.
 *
 * The FIRST address a customer saves is forced to be the default whatever was posted — a book
 * where nothing is the default is a book checkout can't preselect from, and "the only one" is the
 * only sensible answer to which that should be.
 *
 * Returns the id, so a caller that just created one can point at it.
 */
export async function saveCustomerAddress(
  uid: string,
  id: string | null,
  input: NewCustomerAddress,
): Promise<string> {
  const existing = await listCustomerAddresses(uid);
  const now = Date.now();
  const isDefault = input.isDefault || existing.length === 0;

  const data = {
    label: input.label,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    shipping: input.shipping,
    key: shippingKey(input.shipping),
    isDefault,
    updatedAt: now,
  };

  let addressId = id ?? "";

  if (addressId) {
    // `set` with merge, not `update`: a document deleted in another tab would make `update` throw,
    // and re-creating what the customer just asked to save is the kinder outcome.
    await addresses(uid).doc(addressId).set({ createdAt: now, ...data }, { merge: true });
  } else {
    await evictOldest(uid, existing);
    const doc = await addresses(uid).add({ ...data, createdAt: now });
    addressId = doc.id;
  }

  // Re-read rather than reusing `existing`: it predates this write, so the row we just saved would
  // still look non-default and its old default would look current.
  if (isDefault) await applyDefault(uid, addressId, await listCustomerAddresses(uid));

  return addressId;
}

/**
 * Make room for one more when the book is full.
 *
 * The oldest NON-DEFAULT goes: the default is the one address the customer has actually chosen to
 * keep, and evicting it silently would change where their next order ships to.
 */
async function evictOldest(uid: string, existing: CustomerAddress[]): Promise<void> {
  if (existing.length < MAX_ADDRESSES) return;

  const evictable = existing
    .filter((a) => !a.isDefault)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  // Every slot is the default — impossible unless a document was hand-edited, but deleting the
  // default over it is worse than simply letting the book run one long.
  for (const address of evictable.slice(0, existing.length - MAX_ADDRESSES + 1)) {
    await addresses(uid).doc(address.id).delete();
  }
}

export async function deleteCustomerAddress(uid: string, id: string): Promise<void> {
  const existing = await listCustomerAddresses(uid);
  const target = existing.find((a) => a.id === id);
  if (!target) return;

  await addresses(uid).doc(id).delete();

  // Promote the next one rather than leaving the book default-less. `ordered` already puts the
  // most recently touched first, so this picks what the customer used last.
  if (target.isDefault) {
    const next = existing.find((a) => a.id !== id);
    if (next) await applyDefault(uid, next.id, existing.filter((a) => a.id !== id));
  }
}

export async function setDefaultCustomerAddress(uid: string, id: string): Promise<void> {
  const existing = await listCustomerAddresses(uid);
  if (!existing.some((a) => a.id === id)) return;
  await applyDefault(uid, id, existing);
}

/**
 * Record the address an order was just placed to.
 *
 * Called from checkout for signed-in customers only, and deliberately NON-FATAL there: a failure
 * to remember an address must never fail an order that has already been written and is about to be
 * paid for.
 *
 * An address already in the book is TOUCHED, not duplicated — matched on `shippingKey`, so the
 * same clinic typed with different capitalisation stays one card. Touching updates the recipient
 * details too (a clinic that changed its front-desk number), but never the label or the default
 * flag: those are the customer's own filing decisions, and checkout has no business overwriting
 * them.
 */
export async function rememberOrderAddress(
  uid: string,
  input: { firstName: string; lastName: string; phone: string; shipping: OrderShipping },
): Promise<void> {
  const key = shippingKey(input.shipping);
  if (!uid || !key) return;

  const existing = await listCustomerAddresses(uid);
  const match = existing.find((a) => a.key === key);

  if (match) {
    await addresses(uid).doc(match.id).update({
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      shipping: input.shipping,
      updatedAt: Date.now(),
    });
    return;
  }

  await saveCustomerAddress(uid, null, {
    // Checkout can't know what the address is FOR. `other` is honest; the customer can relabel it
    // on /account, and that label then survives every future order to the same place.
    label: "other",
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    shipping: input.shipping,
    isDefault: false,
  });
}
