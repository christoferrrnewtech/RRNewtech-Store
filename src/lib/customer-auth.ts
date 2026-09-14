/**
 * Customer authentication — SERVER ONLY.
 *
 * Storefront accounts, kept deliberately separate from the staff session in `auth.ts`:
 *
 *   - a different cookie (`rrnt_customer`), signed with a key DERIVED from the same base secret, so
 *     neither session's token can be replayed as the other's (see `deriveSecret`)
 *   - a different profile store (`storeCustomers`, not the staff `users` map)
 *   - a much longer life — a shopper should not be signed out every eight hours
 *
 * Credentials themselves are Firebase Authentication's, exactly as they are for staff. The Admin
 * SDK cannot check a password, so sign-in goes through Firebase's Identity Toolkit REST API with
 * FIREBASE_WEB_API_KEY, the same way `auth.ts` verifies admin logins.
 *
 * EMAIL VERIFICATION is Firebase's, not ours: `accounts:sendOobCode` makes Firebase send its own
 * templated verification email and host the confirmation page, so no transactional-email provider
 * is needed (ours is still Phase 2 — see .env.example). The template lives in the Firebase console
 * under Authentication → Templates → Address verification.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase";
import { getCustomer, type Customer } from "@/lib/customers";
import { deriveSecret, readSession, signSession } from "@/lib/session-cookie";
import { CUSTOMER_HINT_COOKIE } from "@/lib/customer-hint";
import { SITE_URL } from "@/lib/constants";

const SESSION_COOKIE = "rrnt_customer";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Cookie carrying the address a just-registered visitor must go and confirm, so `/account/verify`
 * can name it without putting an email address in the URL (and therefore in browser history and
 * any referrer). Short-lived and httpOnly; losing it only costs the visitor a nicer message.
 */
export const PENDING_VERIFY_COOKIE = "rrnt_verify_email";
const PENDING_VERIFY_MAX_AGE = 60 * 30; // 30 minutes

/** The session-safe view of a customer. Never carries credentials. */
export type SessionCustomer = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
};

function sessionSecret(): string {
  const base = process.env.ADMIN_SESSION_SECRET;
  if (base) return deriveSecret(base, "customer");
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production.");
  }
  return deriveSecret("rrnt-local-dev-secret-do-not-use-in-production", "customer");
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Identity Toolkit
// ─────────────────────────────────────────────────────────────────────────────

function webApiKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error("FIREBASE_WEB_API_KEY is not set — cannot sign customers in.");
  return key;
}

async function identityToolkit(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; code: string; data: Record<string, unknown> }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${webApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Firebase reports failures as { error: { message: "INVALID_PASSWORD" } }; the message is a
  // stable machine code, sometimes with a " : detail" suffix we don't need.
  const error = data.error as { message?: string } | undefined;
  const code = String(error?.message ?? "").split(" ")[0];
  return { ok: res.ok, code, data };
}

/** A verified sign-in. `idToken` is short-lived and used only to send the verification email. */
export type SignInResult = { uid: string; idToken: string };

/**
 * Check an email + password against Firebase. Returns null when they don't match — the caller must
 * NOT tell the visitor which half was wrong, or the form becomes an account-enumeration oracle.
 * Throws for conditions the visitor needs to hear about verbatim (locked out, disabled).
 */
export async function signInCustomer(
  email: string,
  password: string,
): Promise<SignInResult | null> {
  const { ok, code, data } = await identityToolkit("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  if (!ok) {
    if (code === "USER_DISABLED") {
      throw new Error("This account has been disabled. Contact us and we'll sort it out.");
    }
    if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
      throw new Error("Too many attempts. Wait a few minutes and try again.");
    }
    return null;
  }

  const uid = typeof data.localId === "string" ? data.localId : "";
  const idToken = typeof data.idToken === "string" ? data.idToken : "";
  return uid && idToken ? { uid, idToken } : null;
}

/** Has this account confirmed its email address? Read from Firebase Auth, which owns the answer. */
export async function isEmailVerified(uid: string): Promise<boolean> {
  const user = await getAdminAuth().getUser(uid);
  return user.emailVerified;
}

export async function emailInUse(email: string): Promise<boolean> {
  try {
    await getAdminAuth().getUserByEmail(email);
    return true;
  } catch {
    return false;
  }
}

/** Create the Firebase Auth account. Throws `EMAIL_TAKEN` if the address is already registered. */
export async function createCustomerAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  try {
    const user = await getAdminAuth().createUser({ email, password, displayName });
    return user.uid;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "auth/email-already-exists") {
      throw new Error("EMAIL_TAKEN");
    }
    throw err;
  }
}

export async function deleteCustomerAccount(uid: string): Promise<void> {
  await getAdminAuth().deleteUser(uid);
}

/**
 * Remembers, for the life of this process, that Firebase refused our `continueUrl`.
 *
 * Without it the fallback below is close to useless. A REJECTED SEND STILL COUNTS AGAINST THE
 * PER-ACCOUNT QUOTA, so "try with continueUrl, then retry without" spends the account's one
 * attempt learning something that is a property of the PROJECT, not of the account — and the retry
 * comes back TOO_MANY_ATTEMPTS_TRY_LATER having sent nothing. Every registration paid that price
 * and every registration failed.
 *
 * Learning it once per instance costs at most one customer per cold start instead of all of them,
 * and it resets on the next deploy, so allowlisting the domain takes effect without any code
 * change. It is a cache of a remote config value, which is why it is only ever set to true: the
 * conservative direction, and the one that still sends mail.
 */
let continueUrlBlocked = false;

/**
 * Ask Firebase to send its templated "verify your email" message.
 *
 * `continueUrl` is what brings the visitor back to us after Firebase's confirmation page. The
 * fallback below exists because Firebase refuses a continueUrl whose host is not on the project's
 * Authorized domains list, and landing on Firebase's own page beats sending nothing.
 *
 * ⚠ SITE_URL'S HOST MUST BE ON THE AUTHORIZED DOMAINS LIST (Firebase console → Authentication →
 * Settings → Authorized domains). This is not a nice-to-have, and the fallback is not a substitute
 * for it: a rejected first attempt still COUNTS AGAINST THE PER-ACCOUNT SEND QUOTA, so the retry
 * comes straight back with TOO_MANY_ATTEMPTS_TRY_LATER and nothing is sent at all. That is exactly
 * how registration stopped emailing anyone — the deployed host was never allowlisted, so every
 * sign-up spent its one attempt on a call that could not succeed. Add each new domain to that list
 * BEFORE pointing NEXT_PUBLIC_SITE_URL at it.
 *
 * Failures are logged with their Identity Toolkit code, because the calling actions treat a failed
 * send as non-fatal — without a log there is nothing anywhere to say why no email arrived.
 */
export async function sendVerificationEmail(idToken: string): Promise<void> {
  if (!continueUrlBlocked) {
    const first = await identityToolkit("sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken,
      continueUrl: `${SITE_URL}/account/login?verified=1`,
    });
    if (first.ok) return;

    console.error(
      `[auth] verification email rejected (${first.code || "unknown"}) for continueUrl host ` +
        `${hostOf(SITE_URL)} — if this is UNAUTHORIZED_DOMAIN, add that host to Firebase ` +
        `Authentication → Settings → Authorized domains.`,
    );

    // Not a continueUrl problem, so a bare retry would fail the same way. Report it as-is.
    if (first.code !== "INVALID_CONTINUE_URI" && first.code !== "UNAUTHORIZED_DOMAIN") {
      throw new Error(first.code || "Could not send the verification email.");
    }
    continueUrlBlocked = true;
  }

  const bare = await identityToolkit("sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
  if (bare.ok) return;

  console.error(`[auth] verification email failed without continueUrl: ${bare.code || "unknown"}`);
  throw new Error(bare.code || "Could not send the verification email.");
}

/** Never throws — used only to make a log line readable. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Send the verification email for an account we can NAME but hold no password for.
 *
 * The resend button on /account/verify needs this. Firebase will only send a verification message
 * for an idToken, and an idToken normally comes from a password — which the visitor has already
 * typed once and should not have to type again just to get a second copy of an email.
 *
 * So the uid is exchanged for one instead: the Admin SDK mints a custom token, Identity Toolkit
 * swaps that for an idToken, and the send proceeds as usual. The private key we already hold is
 * what authorizes it, so no credential of the customer's is stored, cached, or asked for twice.
 *
 * THE CALLER DECIDES WHOSE ACCOUNT THIS IS, AND THAT IS THE WHOLE SECURITY MODEL. This function
 * will happily mail anyone, so a uid must never be derived from something the visitor posted —
 * `resendVerificationAction` reads it from the httpOnly cookie set when they registered, which a
 * stranger cannot write. Driving it from a posted email address would turn it into a way to spam
 * an inbox on demand, and an account-enumeration oracle besides.
 */
export async function sendVerificationEmailForUid(uid: string): Promise<void> {
  const customToken = await getAdminAuth().createCustomToken(uid);

  const { ok, code, data } = await identityToolkit("signInWithCustomToken", {
    token: customToken,
    returnSecureToken: true,
  });
  if (!ok) throw new Error(code || "Could not start a verification session.");

  const idToken = typeof data.idToken === "string" ? data.idToken : "";
  if (!idToken) throw new Error("Could not start a verification session.");

  await sendVerificationEmail(idToken);
}

/**
 * The uid behind an address, but only while it still needs verifying.
 *
 * Returns "" for an unknown address AND for one that is already confirmed, so a resend can't be
 * used to mail someone who has finished — and so the button reports "already confirmed" instead of
 * silently sending a link that would do nothing.
 */
export async function unverifiedUidForEmail(email: string): Promise<string> {
  if (!email) return "";
  try {
    const user = await getAdminAuth().getUserByEmail(email);
    return user.emailVerified ? "" : user.uid;
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function createCustomerSession(customer: SessionCustomer): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession({ ...customer }, sessionSecret(), SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  // Companion hint cookie, readable by client JS so the cart can prompt before adding. Carries no
  // identity and grants nothing — see customer-hint.ts. Written and cleared in lockstep with the
  // real session so the two can't drift apart.
  store.set(CUSTOMER_HINT_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CUSTOMER_HINT_COOKIE);
}

export async function getSessionCustomer(): Promise<SessionCustomer | null> {
  const store = await cookies();
  const data = readSession(store.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!data || typeof data.uid !== "string" || !data.uid) return null;
  return {
    uid: data.uid,
    email: String(data.email ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
  };
}

/**
 * The signed-in customer's full profile, or null.
 *
 * Reads Firestore rather than trusting the cookie's copy of the details: the cookie is valid for
 * 30 days, and a profile edited (or an account deleted) in that window must not keep rendering
 * stale data from a token minted before the change.
 */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const session = await getSessionCustomer();
  if (!session) return null;
  return getCustomer(session.uid);
}

/** Guard for customer-only pages AND every customer server action. */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");
  return customer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending-verification hint cookie
// ─────────────────────────────────────────────────────────────────────────────

export async function setPendingVerifyEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_VERIFY_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/account",
    maxAge: PENDING_VERIFY_MAX_AGE,
  });
}

export async function readPendingVerifyEmail(): Promise<string> {
  const store = await cookies();
  return store.get(PENDING_VERIFY_COOKIE)?.value ?? "";
}
