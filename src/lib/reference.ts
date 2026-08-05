/**
 * Human-readable reference codes for orders and inquiries — SERVER ONLY.
 *
 * Random rather than sequential so no counter document (and therefore no transaction) is needed on
 * the hot path of placing an order. The Firestore document id remains the real key; a reference is
 * only ever displayed and read back over the phone, so it is not looked up by and a collision would
 * be cosmetic rather than corrupting.
 */

import "server-only";
import crypto from "node:crypto";

/** No O/0, I/1, S/5 — these get misread when a customer reads a code back to you. */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
const LENGTH = 6;

/** e.g. makeRef("RR") → "RR-8F3K2M". */
export function makeRef(prefix: string): string {
  const bytes = crypto.randomBytes(LENGTH);
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${prefix}-${code}`;
}
