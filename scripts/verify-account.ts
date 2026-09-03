/**
 * Mark an account as verified without the email round-trip — for accounts we made ourselves.
 *
 * A normal customer confirms their address by clicking the link Firebase emails them, and a PRC
 * licence is confirmed by the (upcoming) automated check. Neither is available for a house account
 * like admin@rnr.com, which nobody is going to receive mail for. This script sets both states
 * directly with the Admin SDK:
 *
 *   1. Firebase Auth  → emailVerified = true   (what /account/login gates on)
 *   2. storeCustomers → prcStatus = "verified" (only if a customer profile exists)
 *
 * Idempotent: a state that is already set is reported and left alone, so re-running does nothing.
 *
 * Run it after filling in .env.local (see .env.example). It writes to the LIVE Firebase project
 * and there is no undo, so look before you leap:
 *
 *     npm run verify:account -- --dry-run                 # report, write nothing
 *     npm run verify:account                              # admin@rnr.com
 *     npm run verify:account -- --email=someone@rnr.com   # a different account
 *
 * NOTE ON SCOPE: this bypasses a deliberate anti-fraud control. It is for accounts the team owns.
 * Never point it at a customer's address to "help them past" a verification they haven't completed
 * — the whole point of the PRC check is that we didn't take their word for it.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const ROOT = process.cwd();

// ── Load .env.local into process.env (so the npm script needs no extra flags) ─────────────────
function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}
loadEnvLocal();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — set it in .env.local (see .env.example).`);
  return v;
}

/** Read `--key=value` off the command line. */
function flag(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).trim() : "";
}

/** The house account this exists for. Override with --email=. */
const DEFAULT_EMAIL = "admin@rnr.com";
const CUSTOMERS = "storeCustomers";

const EMAIL = (flag("email") || DEFAULT_EMAIL).toLowerCase();
const DRY_RUN = process.argv.includes("--dry-run");

initializeApp({
  credential: cert({
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();
const auth = getAuth();

async function main() {
  console.log(`Project : ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Account : ${EMAIL}${DRY_RUN ? "  (dry run)" : ""}\n`);

  // ── 1. Firebase Auth ────────────────────────────────────────────────────────────────────────
  const user = await auth.getUserByEmail(EMAIL).catch(() => null);
  if (!user) {
    console.error(
      `No Firebase Auth user with that email.\n` +
        `Create it first — either by registering at /account/register, or in the Firebase ` +
        `console under Authentication → Users.`,
    );
    process.exit(1);
  }

  console.log(`uid           ${user.uid}`);
  console.log(`displayName   ${user.displayName ?? "—"}`);
  console.log(`emailVerified ${user.emailVerified}`);

  if (user.emailVerified) {
    console.log("→ email already verified, nothing to do.");
  } else if (DRY_RUN) {
    console.log("→ would set emailVerified = true");
  } else {
    await auth.updateUser(user.uid, { emailVerified: true });
    console.log("→ set emailVerified = true");
  }

  // ── 2. Customer profile ─────────────────────────────────────────────────────────────────────
  const ref = db.collection(CUSTOMERS).doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // Not an error: admin@rnr.com is a STAFF account, and staff sign in at /admin/login, which
    // never looks at emailVerified. Say so plainly rather than inventing a profile — the fields a
    // customer profile needs (PRC number, mobile) are real-world identifiers, and a made-up PRC
    // number would collide with some actual practitioner's licence.
    console.log(`\nNo ${CUSTOMERS}/${user.uid} document — this is not a storefront customer.`);
    console.log(
      `Signing in at /account/login would fail with "There's no customer account for this ` +
        `email". If you want one, register at /account/register with this address and real ` +
        `details, then re-run this script to skip the email step.`,
    );
    return;
  }

  const prcStatus = snap.data()?.prcStatus;
  console.log(`\nprcStatus     ${prcStatus ?? "—"}`);

  if (prcStatus === "verified") {
    console.log("→ PRC already verified, nothing to do.");
  } else if (DRY_RUN) {
    console.log('→ would set prcStatus = "verified"');
  } else {
    await ref.update({ prcStatus: "verified", updatedAt: FieldValue.serverTimestamp() });
    console.log('→ set prcStatus = "verified"');
  }
}

main()
  .then(() => {
    if (DRY_RUN) console.log("\nDry run — nothing written. Re-run without --dry-run to apply.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
