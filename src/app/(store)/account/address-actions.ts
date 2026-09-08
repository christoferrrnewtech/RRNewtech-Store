"use server";

/**
 * Address-book mutations for the signed-in customer.
 *
 * SECURITY: every one of these starts at `requireCustomer()` and writes ONLY under that session's
 * own uid. The address id posted from the form is a document id inside the customer's own
 * subcollection, so it cannot address another customer's book however it is tampered with — which
 * is the main reason the book is a subcollection rather than a top-level collection with a uid
 * field to be forgotten in a `where` clause one day.
 *
 * The address itself is re-validated here exactly as checkout validates it: the province/city pair
 * must exist in the PSGC snapshot, the phone must be a real PH mobile number, and every free-text
 * field is length-capped. A server action is a public HTTP endpoint, so the form's own `required`
 * attributes count for nothing.
 */

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer-auth";
import {
  deleteCustomerAddress,
  listCustomerAddresses,
  rememberOrderAddress,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  MAX_ADDRESSES,
} from "@/lib/customer-addresses";
import { listOrdersForCustomer } from "@/lib/orders";
import { deriveAddresses } from "@/lib/addresses";
import { isKnownLocation } from "@/lib/locations";
import { toAddressLabel } from "@/lib/address-book";
import { normalizePhone } from "@/lib/customer-fields";
import { cappedText, text, type ActionState } from "@/lib/form-data";

/** Same caps as checkout — an address stored here is an address that will be posted from there. */
const MAX_NAME = 100;
const MAX_ADDRESS_FIELD = 200;
/** Firestore auto-ids are 20 chars; the cap is the usual boundary discipline. */
const MAX_ID = 64;

/** How much order history to look back through when importing. */
const IMPORT_LOOKBACK = 50;

export async function saveAddressAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const customer = await requireCustomer();

  const id = cappedText(form, "id", MAX_ID);
  const firstName = cappedText(form, "firstName", MAX_NAME);
  const lastName = cappedText(form, "lastName", MAX_NAME);
  const phone = normalizePhone(cappedText(form, "phone", MAX_ADDRESS_FIELD));
  const shipping = {
    address: cappedText(form, "address", MAX_ADDRESS_FIELD),
    apartment: cappedText(form, "apartment", MAX_ADDRESS_FIELD),
    barangay: cappedText(form, "barangay", MAX_ADDRESS_FIELD),
    city: cappedText(form, "city", MAX_ADDRESS_FIELD),
    region: cappedText(form, "region", MAX_ADDRESS_FIELD),
    postal: cappedText(form, "postal", MAX_ADDRESS_FIELD),
    country: "Philippines",
  };

  if (!firstName || !lastName) return { error: "Enter the recipient's first and last name." };
  if (!phone) return { error: "Enter a mobile number as 09XX-XXX-XXXX or 09XXXXXXXXX." };
  if (!shipping.address || !shipping.barangay || !shipping.city || !shipping.region || !shipping.postal) {
    return { error: "Complete every required part of the address." };
  }
  // Checked here rather than only at checkout, so a bad pair can't be saved now and fail later at
  // the courier quote, where it would read as our problem rather than a fixable typo.
  if (!isKnownLocation(shipping.region, shipping.city)) {
    return { error: "We couldn't find that city. Please pick your province and city from the lists." };
  }

  // A book at its ceiling silently evicting a card the customer added by hand would be a nasty
  // surprise; checkout may evict to make room, but a deliberate save says so instead.
  if (!id) {
    const existing = await listCustomerAddresses(customer.uid);
    if (existing.length >= MAX_ADDRESSES) {
      return { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.` };
    }
  }

  try {
    await saveCustomerAddress(customer.uid, id || null, {
      label: toAddressLabel(text(form, "label")),
      firstName,
      lastName,
      phone,
      shipping,
      isDefault: form.get("isDefault") === "on" || form.get("isDefault") === "1",
    });
  } catch (err) {
    console.error("[account] could not save the address:", err);
    return { error: "Could not save that address. Please try again." };
  }

  revalidatePath("/account");
  return { ok: id ? "Address updated." : "Address saved." };
}

export async function deleteAddressAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const customer = await requireCustomer();
  const id = cappedText(form, "id", MAX_ID);
  if (!id) return { error: "That address is no longer there." };

  try {
    await deleteCustomerAddress(customer.uid, id);
  } catch (err) {
    console.error("[account] could not delete the address:", err);
    return { error: "Could not remove that address. Please try again." };
  }

  revalidatePath("/account");
  return { ok: "Address removed." };
}

export async function setDefaultAddressAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const customer = await requireCustomer();
  const id = cappedText(form, "id", MAX_ID);
  if (!id) return { error: "That address is no longer there." };

  try {
    await setDefaultCustomerAddress(customer.uid, id);
  } catch (err) {
    console.error("[account] could not set the default address:", err);
    return { error: "Could not set that as your default. Please try again." };
  }

  revalidatePath("/account");
  return { ok: "Default address updated." };
}

/**
 * Copy the addresses from past orders into the book.
 *
 * Explicit, on a button, rather than a silent backfill when the page renders: a page render is a
 * GET, and having one write documents behind the customer's back is the kind of thing that fires
 * twice under React's concurrent rendering and is impossible to reason about afterwards.
 *
 * Only for customers who ordered before the book existed — anyone ordering since has had their
 * address remembered at checkout, and `rememberOrderAddress` matches on the normalized key, so
 * pressing this twice adds nothing the second time.
 */
export async function importAddressesAction(): Promise<ActionState> {
  const customer = await requireCustomer();

  try {
    const orders = await listOrdersForCustomer(
      { uid: customer.uid, email: customer.email },
      IMPORT_LOOKBACK,
    );
    const derived = deriveAddresses(orders);
    if (derived.length === 0) return { ok: "There were no addresses in your past orders." };

    const before = (await listCustomerAddresses(customer.uid)).length;

    // Oldest first, and one at a time: each write reads the book back to decide the default and
    // whether it needs to evict, so running them concurrently would race over both.
    for (const address of [...derived].reverse()) {
      await rememberOrderAddress(customer.uid, {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        shipping: address.shipping,
      });
    }

    const added = (await listCustomerAddresses(customer.uid)).length - before;
    revalidatePath("/account");
    return {
      ok:
        added > 0
          ? `Added ${added} ${added === 1 ? "address" : "addresses"} from your past orders.`
          : "Your past orders' addresses are already saved.",
    };
  } catch (err) {
    console.error("[account] could not import addresses:", err);
    return { error: "Could not read your past orders just now. Please try again." };
  }
}
