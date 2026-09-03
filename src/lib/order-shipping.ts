/**
 * The delivery-address shape — CLIENT-SAFE.
 *
 * Split out of `orders.ts` for the same reason `order-status.ts` is: that module is `server-only`
 * and pulls in firebase-admin, so anything a client component needs from it has to live outside.
 * `orders.ts` re-exports this type, so existing importers are unaffected.
 */
export type OrderShipping = {
  address: string;
  apartment: string;
  barangay: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};
