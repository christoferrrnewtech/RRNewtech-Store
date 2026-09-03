/**
 * Create (or repair) the storefront test buyer — a customer account the team can sign in with at
 * /account/login without going through registration and the email round-trip.
 *
 * A real customer is three things: a Firebase Auth user, a confirmed email, and a `storeCustomers`
 * profile. Registering through the form produces all three; this produces the same shape directly,
 * with the email pre-confirmed.
 *
 * Idempotent: re-running resets the password and re-asserts every field, so a test account someone
 * has poked at can always be restored to a known state.
 *
 *     npm run seed:test-buyer -- --dry-run   # report what would change, write nothing
 *     npm run seed:test-buyer                # create or repair
 *
 * NOT FOR PRODUCTION DATA. The PRC number below is a deliberate all-zero sentinel, not a licence,
 * and the profile carries no ID photo — so this account must never be used to exercise the PRC
 * verification path, which would (correctly) reject it.
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

/** Collection name is duplicated rather than imported: `firebase.ts` is `server-only`. */
const CUSTOMERS = "storeCustomers";

const TEST_BUYER = {
  email: "test@rnr.com",
  password: "rnr123!",
  firstName: "Test",
  lastName: "Buyer",
  /** Canonical 11-digit form, as `normalizePhone` would store it. */
  phone: "09000000000",
  /**
   * All zeros: 7 digits so it satisfies the 6-or-7 rule, and not a number the PRC would ever
   * issue — so it can't collide with a real practitioner's licence the way an invented-looking
   * one could.
   */
  prcId: "0000000",
  /** No card photo exists for a synthetic account; nothing reads this when it's empty. */
  prcIdImagePath: "",
  /**
   * "verified" rather than "pending": there is no image here for the check to ever act on, so
   * leaving it pending would park the account on "Awaiting verification" forever.
   */
  prcStatus: "verified" as const,
};

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
  console.log(`Account : ${TEST_BUYER.email}${DRY_RUN ? "  (dry run)" : ""}\n`);

  const displayName = `${TEST_BUYER.firstName} ${TEST_BUYER.lastName}`;
  const existing = await auth.getUserByEmail(TEST_BUYER.email).catch(() => null);

  // ── 1. Firebase Auth ────────────────────────────────────────────────────────────────────────
  let uid: string;
  if (existing) {
    uid = existing.uid;
    console.log(`Auth user exists  ${uid}`);
    console.log(`  emailVerified   ${existing.emailVerified}`);
    if (DRY_RUN) {
      console.log("  → would reset password, displayName, and emailVerified = true");
    } else {
      await auth.updateUser(uid, {
        password: TEST_BUYER.password,
        displayName,
        emailVerified: true,
      });
      console.log("  → password reset, emailVerified = true");
    }
  } else if (DRY_RUN) {
    uid = "(not created — dry run)";
    console.log("Auth user missing → would create it with emailVerified = true");
  } else {
    // Created verified outright, so no confirmation email is ever sent for this address.
    const created = await auth.createUser({
      email: TEST_BUYER.email,
      password: TEST_BUYER.password,
      displayName,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Auth user created ${uid}  (emailVerified = true)`);
  }

  // ── 2. Customer profile ─────────────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(`\nWould write ${CUSTOMERS}/${uid}:`);
    const { password: _pw, ...profile } = TEST_BUYER;
    void _pw;
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  const ref = db.collection(CUSTOMERS).doc(uid);
  const snap = await ref.get();
  const { password: _pw, ...profile } = TEST_BUYER;
  void _pw;

  await ref.set(
    {
      ...profile,
      // Preserve the original creation time on a repair, so the account doesn't look brand new.
      createdAt: snap.exists ? snap.data()?.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`\n${snap.exists ? "Updated" : "Created"} ${CUSTOMERS}/${uid}`);

  console.log(`\nSign in at /account/login`);
  console.log(`  email    ${TEST_BUYER.email}`);
  console.log(`  password ${TEST_BUYER.password}`);
}

main()
  .then(() => {
    if (DRY_RUN) console.log("\nDry run — nothing written. Re-run without --dry-run to apply.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
