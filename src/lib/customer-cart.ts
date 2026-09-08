/**
 * A signed-in customer's cart — SERVER ONLY.
 *
 * Storage shape: `storeCustomers/{uid}/cart/current` — a `cart` SUBCOLLECTION under the customer's
 * own document holding exactly ONE document. Under the customer document for the same reason the
 * address book is (`customer-addresses.ts`): there is no `uid` field to filter on, so there is no
 * way to accidentally query across customers, and deleting a customer takes their cart with them.
 *
 * ONE DOCUMENT, not one per line — the opposite of the address book, deliberately. An address book
 * is edited a card at a time and two tabs touching different cards must not clobber each other. A
 * cart is the opposite: it is read whole on every page load, written whole on every change, and
 * replaced wholesale at checkout. A document per line would turn one read into N and buy nothing,
 * because "the cart as the customer last left it" is the unit of correctness here, not the line.
 *
 * WHY THE SERVER HOLDS THIS AT ALL. The cart lives in localStorage (see cart.tsx) and always will —
 * it is what makes Add-to-cart instant and what keeps the cart working when Firestore is
 * unreachable. But localStorage is per-browser and disposable: clearing site data, a private
 * window, a new laptop, or signing out on a shared clinic machine all lose the cart entirely. This
 * is the durable copy that survives all of those, and the reason a cart built on a phone shows up
 * on the desktop at checkout.
 *
 * THE CART IS NOT A PRICE. Lines carry a snapshot of what the catalog said when they were added,
 * exactly as the localStorage copy does, and it drifts for the same reasons. Nothing here is
 * trusted at checkout: `placeOrderAction` re-reads every price from the catalog and re-quotes
 * shipping before a peso reaches PayMongo. Persisting a cart server-side does NOT make its prices
 * authoritative, and no future caller should treat it as if it did.
 */

import "server-only";
import crypto from "node:crypto";
import { COLLECTIONS, storeCollection } from "@/lib/firebase";
import { isCartItem, type CartItem } from "@/lib/cart-item";

/**
 * How many distinct lines a stored cart may hold.
 *
 * A ceiling rather than a policy, like MAX_ADDRESSES: the browser posts this list, so without one
 * a forged request could park a megabyte under someone's profile. Far beyond any real order — the
 * per-line quantity cap (MAX_QUANTITY) is what a genuine bulk order uses.
 */
export const MAX_CART_LINES = 60;

/** The single document. Named rather than auto-id'd so it can be read without a query. */
const CART_DOC = "current";

function cartDoc(uid: string) {
  return storeCollection(COLLECTIONS.customers).doc(uid).collection("cart").doc(CART_DOC);
}

/**
 * An opaque, stable stand-in for "which account this browser's cart belongs to".
 *
 * The browser has to be able to tell "this local cart is my own stale mirror" from "this local
 * cart belongs to whoever used this machine before me" — the two demand opposite merge decisions
 * (see `reconcileCarts`). It cannot read the uid: the customer session is httpOnly, which is the
 * whole point of it. So the sync hands back this token instead, the browser stores it next to the
 * cart, and sends it up next time.
 *
 * A hash, not the uid, because this value is readable by any script on the page and ends up in
 * localStorage: it needs to be comparable, not meaningful. It is NOT a credential and grants
 * nothing — every action re-reads the signed session and writes only under that session's uid.
 */
export function cartOwnerToken(uid: string): string {
  return crypto.createHash("sha256").update(`rrnt:cart:${uid}`).digest("hex").slice(0, 16);
}

export type StoredCart = {
  items: CartItem[];
  /**
   * Whether a cart document has ever been written for this customer.
   *
   * Load-bearing, not informational: "no cart on the server" and "an empty cart on the server" mean
   * opposite things. The first is a customer who predates this feature, whose local cart must be
   * adopted; the second is a customer who emptied their cart (or checked out) on another device,
   * whose local copy must be cleared to match. Distinguishing them is the only thing standing
   * between this feature and silently wiping the carts of every customer who had one when it
   * shipped.
   */
  exists: boolean;
  updatedAt: number;
};

/**
 * Drop anything that isn't a well-formed line and cap the length.
 *
 * The same defensive posture the localStorage copy gets in `parseItems`, for a stronger reason:
 * these values arrive from a Server Action, which is a public HTTP endpoint that will happily be
 * called with whatever a script feels like sending.
 */
function sanitize(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: CartItem[] = [];
  for (const raw of value) {
    if (!isCartItem(raw)) continue;
    // The key is the cart's dedupe key; a posted list carrying it twice would make the merge
    // below depend on iteration order.
    if (seen.has(raw.key)) continue;
    seen.add(raw.key);
    items.push(raw);
    if (items.length >= MAX_CART_LINES) break;
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomerCart(uid: string): Promise<StoredCart> {
  if (!uid) return { items: [], exists: false, updatedAt: 0 };

  const snap = await cartDoc(uid).get();
  if (!snap.exists) return { items: [], exists: false, updatedAt: 0 };

  const data = snap.data() ?? {};
  return {
    items: sanitize(data.items),
    exists: true,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace the stored cart wholesale. Returns what was actually written, which is what the caller
 * should hand back to the browser — sanitizing may have dropped lines, and a client left believing
 * it stored something the server rejected would re-send it forever.
 */
export async function saveCustomerCart(uid: string, items: unknown): Promise<CartItem[]> {
  const clean = sanitize(items);
  // `set` without merge: the cart IS the array, so a merge would leave lines the customer removed
  // sitting in the document under whatever keys the old array happened to have.
  await cartDoc(uid).set({ items: clean, updatedAt: Date.now() });
  return clean;
}

/**
 * Empty the cart, keeping the document.
 *
 * Emptied rather than deleted, and that distinction matters: a deleted document reads back as
 * `exists: false`, which `reconcileCarts` treats as "this customer predates the feature, adopt
 * whatever the browser has" — and would therefore restore the very cart that was just paid for the
 * next time any device with a stale copy loaded a page.
 */
export async function clearCustomerCart(uid: string): Promise<void> {
  if (!uid) return;
  await cartDoc(uid).set({ items: [], updatedAt: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation
// ─────────────────────────────────────────────────────────────────────────────

/** What the browser and the server do when they meet. See `reconcileCarts`. */
export type CartSyncMode = "adopt" | "mirror" | "replace";

/**
 * Union of both carts, keyed by line key.
 *
 * MAX of the two quantities, never the sum: the common case is two copies of a cart that are
 * already the same, and summing would silently double every line each time a second device opened
 * the site. Max still lets a genuine "+2 on my phone" win over a stale desktop copy.
 *
 * Local wins on the display fields, because local is what the customer is looking at right now.
 */
function union(local: CartItem[], remote: CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();
  for (const item of remote) byKey.set(item.key, item);
  for (const item of local) {
    const existing = byKey.get(item.key);
    byKey.set(
      item.key,
      existing ? { ...item, quantity: Math.max(item.quantity, existing.quantity) } : item,
    );
  }
  return [...byKey.values()].slice(0, MAX_CART_LINES);
}

/**
 * Decide what this browser's cart should become, given what the server holds.
 *
 * Three cases, and they are genuinely different — collapsing any two of them produces a bug a
 * customer would notice:
 *
 *   adopt   — the browser has no owner token (a cart built before this shipped, or before signing
 *             in), or the server has no document yet. Nothing here can be a stale mirror, so
 *             UNION: whatever is on either side is something the customer chose and nothing may be
 *             thrown away.
 *
 *   mirror  — the token matches and the browser reports nothing unsaved: this copy is a snapshot of
 *             this same account's cart, taken at some earlier point. THE SERVER WINS OUTRIGHT,
 *             including when it is empty. That is the case that makes a removal — or a completed
 *             checkout — on the phone actually disappear from the laptop, which union would undo by
 *             resurrecting the line.
 *
 *             `dirty` is what keeps that safe. The browser sets it the moment it changes the cart
 *             and clears it only once a save is CONFIRMED, so a tab closed during the save debounce
 *             comes back still dirty and takes the union path instead. Without it, mirror would
 *             quietly discard the last thing the customer did before closing the tab — the exact
 *             failure this feature exists to prevent. Resurrecting a removed line is the worse of
 *             the two directions to be wrong in, and the one this trades toward.
 *
 *   replace — the token belongs to a DIFFERENT account. A shared clinic machine where someone else
 *             signed in. The previous customer's cart is discarded, never merged: quietly moving
 *             one customer's items into another's cart is the worst outcome available here, and it
 *             outranks `dirty` — those unsaved changes belong to the account that has signed out.
 */
export function reconcileCarts(
  local: unknown,
  stored: StoredCart,
  posted: { owner: string; dirty: boolean },
  currentOwner: string,
): { items: CartItem[]; mode: CartSyncMode } {
  if (posted.owner && posted.owner !== currentOwner) {
    return { items: stored.items, mode: "replace" };
  }
  if (posted.owner === currentOwner && stored.exists && !posted.dirty) {
    return { items: stored.items, mode: "mirror" };
  }
  return { items: union(sanitize(local), stored.items), mode: "adopt" };
}
