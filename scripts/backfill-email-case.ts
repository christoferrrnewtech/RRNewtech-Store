/**
 * One-time migration: lower-case the email on existing orders and inquiries.
 *
 * /account shows a customer their own orders and inquiries by matching on email. Firestore's `==`
 * is case-sensitive, and checkout used to store the address exactly as typed — so an order placed
 * as "Test@gmail.com" is invisible to an account registered as "test@gmail.com". The customer sees
 * an empty history and has no way to tell it is wrong.
 *
 * `placeOrderAction` and `sendInquiryAction` now lower-case on write; this brings the records that
 * predate that into line.
 *
 * Idempotent: only documents whose email is not already lower-case are touched, so re-running does
 * nothing. A no-op on empty collections.
 *
 * It writes to the live Firestore project and there is no undo, so look before you leap:
 *
 *     npm run backfill:email-case -- --dry-run   # report what would change, write nothing
 *     npm run backfill:email-case                # actually write
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

const DRY_RUN = process.argv.includes("--dry-run");

initializeApp({
  credential: cert({
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

/**
 * Orders nest the address under `customer.email`; inquiries hold it at the top level. The dotted
 * path is what the update uses, so only that field is rewritten and the rest of the document —
 * including anything added since — is left untouched.
 */
const TARGETS = [
  { collection: "storeOrders", path: "customer.email" },
  { collection: "storeInquiries", path: "email" },
] as const;

function read(data: Record<string, unknown>, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], data);
  return typeof value === "string" ? value : "";
}

async function migrate(collection: string, path: string): Promise<number> {
  const snap = await db.collection(collection).get();
  if (snap.empty) {
    console.log(`${collection}: empty — nothing to do.`);
    return 0;
  }

  const stale = snap.docs.filter((d) => {
    const email = read(d.data() ?? {}, path);
    return email !== "" && email !== email.toLowerCase();
  });

  console.log(`${collection}: ${snap.size} doc(s), ${stale.length} with a mixed-case email.`);
  if (stale.length === 0) return 0;

  for (const doc of stale) {
    const email = read(doc.data() ?? {}, path);
    console.log(`  ${doc.id}  ${email} → ${email.toLowerCase()}`);
  }
  if (DRY_RUN) return stale.length;

  // Firestore caps a batch at 500 writes; chunk rather than assume the collection is small.
  for (let i = 0; i < stale.length; i += 400) {
    const chunk = stale.slice(i, i + 400);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { [path]: read(doc.data() ?? {}, path).toLowerCase() });
    }
    await batch.commit();
    console.log(`  committed ${chunk.length} update(s)`);
  }
  return stale.length;
}

async function main() {
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}${DRY_RUN ? "  (dry run)" : ""}\n`);
  let total = 0;
  for (const { collection, path } of TARGETS) {
    total += await migrate(collection, path);
    console.log("");
  }
  console.log(
    DRY_RUN
      ? `Dry run — nothing written. ${total} document(s) would change.`
      : `Done. ${total} document(s) normalized.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
