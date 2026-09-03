"use server";

/**
 * Customer account mutations: register, sign in, sign out.
 *
 * SECURITY: these are public, unauthenticated endpoints — a server action is a directly callable
 * HTTP route, so the browser-side `required`/`pattern`/`accept` attributes on the form count for
 * nothing here. Every field is re-validated below against the shared rules in `customer-fields.ts`,
 * and every free-text value is length-capped so a document can't be bloated from outside.
 *
 * ACCOUNT ENUMERATION: sign-in never says which half of the pair was wrong. Registration does have
 * to say "that email is already registered" — there is no way to offer a usable sign-up form
 * otherwise — so that one disclosure is deliberate and bounded to the register form.
 *
 * A sign-up touches three stores that can't be written atomically (Firebase Auth, Cloud Storage,
 * Firestore). Each step therefore unwinds the ones before it on failure, so a half-created account
 * never survives to block the visitor's next attempt.
 *
 * ONE FRONT DOOR: Firebase Auth holds both customers and staff, so /account/login accepts either
 * and routes on which profile the uid has — a customer gets a customer session, a staff member
 * gets the ADMIN session and lands on /admin without having to know that URL. /admin/login still
 * exists and is unchanged; this is a second way in, not a replacement.
 */

import { redirect } from "next/navigation";
import {
  createCustomerAccount,
  createCustomerSession,
  deleteCustomerAccount,
  destroyCustomerSession,
  emailInUse,
  isEmailVerified,
  sendVerificationEmail,
  setPendingVerifyEmail,
  signInCustomer,
} from "@/lib/customer-auth";
import {
  createCustomer,
  deleteCustomer,
  deletePrcIdImage,
  getCustomer,
  prcIdTaken,
  uploadPrcIdImage,
} from "@/lib/customers";
import {
  isPrcId,
  looksLikeEmail,
  MAX_EMAIL,
  MAX_NAME,
  MAX_PASSWORD,
  MAX_PRC_IMAGE_BYTES,
  MIN_PASSWORD,
  normalizePhone,
  PRC_IMAGE_TYPES,
} from "@/lib/customer-fields";
import { createSession } from "@/lib/auth";
import { getUserByUid } from "@/lib/content";
import { cappedText, text, type ActionState } from "@/lib/form-data";

/** Honeypot — same field and reasoning as the storefront's other public forms. */
function isBot(form: FormData): boolean {
  return text(form, "company").length > 0;
}

/** Passwords are never trimmed: a leading or trailing space is a character the visitor chose. */
function password(form: FormData, key: string): string {
  return String(form.get(key) ?? "");
}

const ALLOWED_IMAGE_TYPES = new Set<string>(PRC_IMAGE_TYPES);

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate the posted sign-up. Returns either the clean values or the one message to show —
 * separated from the write path below so the ordering of checks is readable in one place.
 */
type Registration = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  prcId: string;
  pass: string;
  image: File;
};

function parseRegistration(form: FormData): Registration | { error: string } {
  const firstName = cappedText(form, "firstName", MAX_NAME);
  const lastName = cappedText(form, "lastName", MAX_NAME);
  const email = cappedText(form, "email", MAX_EMAIL).toLowerCase();
  const phone = normalizePhone(text(form, "phone"));
  const prcId = text(form, "prcId");
  const pass = password(form, "password");
  const confirm = password(form, "confirmPassword");
  const image = form.get("prcIdImage");

  if (!firstName) return { error: "Enter your first name." };
  if (!lastName) return { error: "Enter your last name." };
  if (!looksLikeEmail(email)) return { error: "Enter a valid email address." };
  if (!phone) return { error: "Enter a mobile number as 09XX-XXX-XXXX or 09XXXXXXXXX." };
  if (!isPrcId(prcId)) return { error: "Your PRC ID number must be 6 or 7 digits." };

  if (!(image instanceof File) || image.size === 0) {
    return { error: "Upload a photo of your PRC ID." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return { error: "Upload your PRC ID as a PNG, JPG or WebP image." };
  }
  if (image.size > MAX_PRC_IMAGE_BYTES) {
    return { error: "The PRC ID image must be 8 MB or smaller." };
  }

  if (pass.length < MIN_PASSWORD) {
    return { error: `Use a password of at least ${MIN_PASSWORD} characters.` };
  }
  if (pass.length > MAX_PASSWORD) {
    return { error: `Passwords are limited to ${MAX_PASSWORD} characters.` };
  }
  if (pass !== confirm) return { error: "The two passwords don't match." };

  return { firstName, lastName, email, phone, prcId, pass, image };
}

export async function registerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // A bot gets the same destination a human does, so a filled honeypot teaches it nothing.
  if (isBot(form)) redirect("/account/verify");

  const parsed = parseRegistration(form);
  if ("error" in parsed) return parsed;
  const { firstName, lastName, email, phone, prcId, pass, image } = parsed;

  try {
    if (await emailInUse(email)) {
      return { error: "That email is already registered. Sign in instead." };
    }
    if (await prcIdTaken(prcId)) {
      return { error: "That PRC ID number is already registered. Contact us if this is yours." };
    }
  } catch {
    return { error: "We couldn't create your account. Please try again." };
  }

  let uid: string;
  try {
    uid = await createCustomerAccount(email, pass, `${firstName} ${lastName}`);
  } catch (err) {
    // `emailInUse` above is a courtesy check; this is the one that actually holds, since Firebase
    // decides the winner when two people submit the same address at the same moment.
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return { error: "That email is already registered. Sign in instead." };
    }
    return { error: "We couldn't create your account. Please try again." };
  }

  let imagePath = "";
  try {
    // Uploaded after the account exists so the object can be filed under the uid it belongs to.
    imagePath = await uploadPrcIdImage(image, uid);
    await createCustomer({
      uid,
      firstName,
      lastName,
      email,
      phone,
      prcId,
      prcIdImagePath: imagePath,
    });
  } catch {
    // Unwind in reverse. Each step is best-effort: the profile may never have been written, and
    // `deletePrcIdImage` is a no-op on an empty path — but the Auth user must not be left behind,
    // or the visitor's retry would bounce off "already registered".
    await deleteCustomer(uid).catch(() => {});
    await deletePrcIdImage(imagePath).catch(() => {});
    await deleteCustomerAccount(uid).catch(() => {});
    return { error: "We couldn't save your PRC ID. Please try again." };
  }

  // Sending the verification email needs an idToken, and only a real sign-in produces one — the
  // Admin SDK can generate the link but cannot make Firebase send it. Signing in here costs
  // nothing: we already hold the password the visitor just chose. A failure to send is not worth
  // destroying a good account over; the visitor can trigger a fresh link by signing in.
  try {
    const signedIn = await signInCustomer(email, pass);
    if (signedIn) await sendVerificationEmail(signedIn.idToken);
  } catch {
    // Intentionally ignored — see above.
  }

  // The account exists but is unverified, and is deliberately NOT signed in: the visitor confirms
  // the address first, then signs in normally.
  await setPendingVerifyEmail(email);
  redirect("/account/verify");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign in / out
// ─────────────────────────────────────────────────────────────────────────────

export async function loginCustomerAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = cappedText(form, "email", MAX_EMAIL).toLowerCase();
  const pass = password(form, "password");
  if (!email || !pass) return { error: "Enter your email and password." };

  let uid: string;
  let idToken: string;
  try {
    const result = await signInCustomer(email, pass);
    if (!result) return { error: "Incorrect email or password." };
    ({ uid, idToken } = result);
  } catch (err) {
    // signInCustomer throws only for states the visitor needs told verbatim (disabled, rate limit).
    return {
      error:
        err instanceof Error && /disabled|attempts/i.test(err.message)
          ? err.message
          : "Sign-in is temporarily unavailable. Please try again.",
    };
  }

  // Where to send them once the try block below has decided. Kept out of the try because
  // `redirect` signals by throwing, and would otherwise be caught as a failure.
  let destination = "/account";
  try {
    // The password is proven; what remains is WHICH kind of account this uid is. Customer profile
    // first: this is the customer door, so someone who has both should get the session they came
    // for and can still reach /admin/login directly.
    const profile = await getCustomer(uid);

    if (profile) {
      if (!(await isEmailVerified(uid))) {
        // The credentials are good, so this is also the natural place to re-send the link — no
        // separate "resend" endpoint that would work from an email address alone.
        await sendVerificationEmail(idToken).catch(() => {});
        await setPendingVerifyEmail(email);
        destination = "/account/verify?resent=1";
      } else {
        await createCustomerSession({
          uid: profile.uid,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        });
      }
    } else {
      // No customer profile. A staff member signing in at the wrong door is the common case, so
      // route them rather than refusing — same credentials, same Firebase Auth user, and the
      // session created here is the identical one /admin/login would have issued.
      //
      // NOT gated on `isEmailVerified`, deliberately: /admin/login has never checked it, and
      // adding the check on this path would lock a staff member out through a side door over a
      // confirmation email nobody ever asked them to click.
      const staff = await getUserByUid(uid);
      if (!staff) {
        // Neither a customer nor staff — a sign-up that was unwound, or an account provisioned in
        // Firebase Auth and never given a profile.
        return { error: "There's no customer account for this email. Register to create one." };
      }
      await createSession({
        uid: staff.uid,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        brandSlugs: staff.brandSlugs,
      });
      destination = "/admin";
    }
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  redirect(destination);
}

export async function logoutCustomerAction(): Promise<void> {
  await destroyCustomerSession();
  redirect("/");
}
