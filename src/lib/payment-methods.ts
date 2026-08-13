/**
 * What the hosted checkout accepts — CLIENT-SAFE.
 *
 * Its own module rather than a constant in `actions.ts` because that file is `"use server"`, and a
 * `"use server"` module may only export async functions. The pay page has to render these, so they
 * live here.
 *
 * THESE ARE PAYMONGO'S OWN KEYS, not display names — `paymaya` is Maya, `grab_pay` is GrabPay,
 * `qrph` is QR Ph. Use PAYMENT_METHOD_LABELS for anything a customer reads.
 *
 * EVERY METHOD LISTED MUST BE ACTIVATED ON THE PAYMONGO ACCOUNT. An inactive one doesn't quietly
 * disappear from the hosted page — PayMongo rejects the whole create-session call with a 400, so a
 * single unactivated entry takes down ALL payments, not just that method. That is why this is a
 * plain constant and not an env var: a per-environment list would let test and live drift apart
 * silently, and the failure only shows up in production.
 *
 * ORDER IS RENDER ORDER on PayMongo's page. E-wallets first, card last, matching how people
 * actually pay in the Philippines.
 */

export const PAYMENT_METHOD_TYPES = ["qrph", "gcash", "paymaya", "grab_pay", "card"] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  qrph: "QR Ph",
  gcash: "GCash",
  paymaya: "Maya",
  grab_pay: "GrabPay",
  card: "Credit or debit card",
};

/**
 * The one-line list for marketing copy, so the storefront can't drift from what's actually
 * accepted: "QR Ph, GCash, Maya, GrabPay or card".
 */
export const PAYMENT_METHODS_SENTENCE = (() => {
  const short: Record<PaymentMethodType, string> = { ...PAYMENT_METHOD_LABELS, card: "card" };
  const names = PAYMENT_METHOD_TYPES.map((t) => short[t]);
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
})();
