"use server";

/**
 * Cart sync between the browser and the signed-in customer's stored cart.
 *
 * The storefront has no client Firestore SDK — every read and write in this app goes through the
 * Admin SDK on the server (see firestore.rules, which denies the client everything under
 * `storeCustomers`). So the cart syncs through these two actions rather than a live listener.
 *
 * SECURITY: both start at `getSessionCustomer()` and touch ONLY that session's own uid. The uid is
 * never accepted from the caller — the owner token the browser sends is used to decide a MERGE
 * STRATEGY, never to choose whose cart is written. Forging it gets you a different reconciliation
 * of your own cart and nothing else.
 *
 * A signed-out caller gets `{ signedIn: false }` rather than an error. Guests keep working exactly
 * as before, entirely in localStorage; there is simply nowhere durable to put their cart.
 */

import { getSessionCustomer } from "@/lib/customer-auth";
import {
  cartOwnerToken,
  getCustomerCart,
  reconcileCarts,
  saveCustomerCart,
  type CartSyncMode,
} from "@/lib/customer-cart";
import type { CartItem } from "@/lib/cart-item";

/** Cap on the posted list, checked before anything is parsed. Lines are capped again in
 *  `sanitize`; this is the cheap first gate so a giant array is never even walked. */
const MAX_POSTED_LINES = 200;

export type CartSyncResult =
  | { signedIn: false }
  | { signedIn: true; items: CartItem[]; owner: string; mode: CartSyncMode };

/**
 * Bring this browser and the server to agreement, once per page load.
 *
 * Returns the reconciled cart, which the browser then adopts wholesale, plus the owner token to
 * store alongside it. The reconciled cart is written back here rather than left to the debounced
 * save: `adopt` may have merged in lines the server has never seen, and a customer who closes the
 * tab immediately after loading it must not lose them.
 */
export async function syncCartAction(input: {
  items: unknown;
  owner: string;
  dirty: boolean;
}): Promise<CartSyncResult> {
  const session = await getSessionCustomer();
  if (!session) return { signedIn: false };

  const owner = cartOwnerToken(session.uid);
  const posted = Array.isArray(input?.items) ? input.items.slice(0, MAX_POSTED_LINES) : [];

  const stored = await getCustomerCart(session.uid);
  const { items, mode } = reconcileCarts(posted, stored, {
    owner: typeof input?.owner === "string" ? input.owner.slice(0, 64) : "",
    dirty: input?.dirty === true,
  }, owner);

  // Only write when the result actually differs from what is stored. A `mirror` — by far the most
  // common case, since it is every page load on a device that is already in sync — then costs one
  // read and no write at all.
  const changed = mode !== "mirror" && !sameCart(items, stored.items);
  const saved = changed || !stored.exists ? await saveCustomerCart(session.uid, items) : items;

  return { signedIn: true, items: saved, owner, mode };
}

/**
 * Persist the cart as it now stands. Called debounced, after the customer changes something.
 *
 * `owner` is a GUARD, not an address: a tab left open from a previous customer's session on a
 * shared machine would otherwise flush that stale cart into whoever signed in next. A mismatch is
 * refused rather than corrected, because this action has no idea which of the two is current — the
 * next `syncCartAction` does, and will sort it out.
 */
export async function saveCartAction(input: {
  items: unknown;
  owner: string;
}): Promise<{ saved: boolean }> {
  const session = await getSessionCustomer();
  if (!session) return { saved: false };

  if (input?.owner !== cartOwnerToken(session.uid)) return { saved: false };

  const posted = Array.isArray(input?.items) ? input.items.slice(0, MAX_POSTED_LINES) : [];

  try {
    await saveCustomerCart(session.uid, posted);
    return { saved: true };
  } catch (err) {
    // Never surfaced to the customer: the cart they can see is the localStorage copy, which is
    // already updated. Losing the durable copy of one change is a far smaller problem than an
    // error toast on a cart that visibly worked.
    console.error("[cart] could not save the cart:", err);
    return { saved: false };
  }
}

/** Cheap structural compare — the lists are short and always in insertion order. */
function sameCart(a: CartItem[], b: CartItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.key === b[i].key && item.quantity === b[i].quantity);
}
