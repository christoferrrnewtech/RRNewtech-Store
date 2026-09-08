/**
 * The saved-address RECORD and its label vocabulary — CLIENT-SAFE.
 *
 * Split out of `customer-addresses.ts` for the same reason `order-status.ts` and `order-shipping.ts`
 * are split out of `orders.ts`: that module is `server-only`, and the checkout picker and the
 * account address form are both client components that render these records and post these values.
 * `customer-addresses.ts` re-exports everything here, so server-side importers need not know.
 *
 * A dentist orders to a clinic far more often than to a house, so "clinic" earns its place beside
 * the usual home/work pair. `other` is the catch-all — deliberately not free text, because a label
 * is a filing aid on a list of three or four cards, not a second address line.
 */

import type { OrderShipping } from "@/lib/order-shipping";

export const ADDRESS_LABELS = ["home", "work", "clinic", "other"] as const;

export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export const ADDRESS_LABEL_NAMES: Record<AddressLabel, string> = {
  home: "Home",
  work: "Work",
  clinic: "Clinic",
  other: "Other",
};

/** Anything unrecognised — a hand-posted value, an older document — files as `other`. */
export function toAddressLabel(value: unknown): AddressLabel {
  return ADDRESS_LABELS.includes(value as AddressLabel) ? (value as AddressLabel) : "other";
}

/** One card in a customer's address book — see `customer-addresses.ts` for how it is stored. */
export type CustomerAddress = {
  /** Firestore document id within the customer's own `addresses` subcollection. */
  id: string;
  label: AddressLabel;
  /**
   * Who receives the delivery here, which is NOT always the account holder — a clinic address
   * takes the clinic's front desk and its landline. Checkout posts these beside the address, so
   * storing them with it is what makes a saved address fill the whole form rather than half of it.
   */
  firstName: string;
  lastName: string;
  /** Canonical 11-digit form, 09XXXXXXXXX — same rule as the profile's own number. */
  phone: string;
  shipping: OrderShipping;
  /** The one checkout preselects. Exactly one address is the default whenever any exist. */
  isDefault: boolean;
  /** Normalized identity — see `shippingKey`. Stored so a repeat checkout updates, not duplicates. */
  key: string;
  createdAt: number;
  updatedAt: number;
};

/** What a caller supplies to save one; the id, key and timestamps are stamped server-side. */
export type NewCustomerAddress = Omit<CustomerAddress, "id" | "key" | "createdAt" | "updatedAt">;
