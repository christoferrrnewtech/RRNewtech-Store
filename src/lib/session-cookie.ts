/**
 * Signed session-cookie plumbing, shared by the admin session (`auth.ts`) and the customer session
 * (`customer-auth.ts`).
 *
 * The token is `base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payload))`. Nothing
 * here is encrypted — the payload is readable by anyone holding the cookie, so it must never carry
 * credentials. The signature is what makes it unforgeable.
 *
 * No `server-only` import so the module stays testable, but there is no reason to import it from a
 * client component: it needs the signing secret to do anything.
 */

import crypto from "node:crypto";

/** The expiry stamped into every payload. Read back by `readSession` before the caller sees it. */
type Expiring = { exp: number };

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Derive a distinct signing key per cookie kind from one base secret.
 *
 * Without this, an admin session cookie and a customer session cookie would be signed by the same
 * key, and a token minted for one could be replayed into the other's cookie name — the signature
 * would verify and only the payload's shape would stand between it and a session. Deriving means a
 * customer token simply fails admin verification, and vice versa.
 */
export function deriveSecret(base: string, kind: string): string {
  return crypto.createHmac("sha256", base).update(`session:${kind}`).digest("base64url");
}

/** Serialize + sign a payload with `maxAgeSeconds` of life. */
export function signSession(
  data: Record<string, unknown>,
  secret: string,
  maxAgeSeconds: number,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + maxAgeSeconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a token's signature and expiry, returning its payload — or null if the token is missing,
 * malformed, tampered with, or expired. Callers still have to validate the payload's SHAPE; this
 * only proves we minted it and that it hasn't lapsed.
 */
export function readSession(
  token: string | undefined,
  secret: string,
): (Record<string, unknown> & Expiring) | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  // Constant-time compare so a bad signature can't be discovered byte by byte.
  const expected = sign(payload, secret);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
