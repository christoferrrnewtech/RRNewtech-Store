/**
 * One-time migration: stamp payment fields onto orders written before the PayMongo integration.
 *
 * Those documents have no `paymentStatus`, and `toPaymentStatus()` in src/lib/orders.ts defaults a
 * missing value to "awaiting_payment" — which would hide every historic order behind the admin's
 * new paid-by-default filter. They were in fact settled by hand, so they are marked
 * `paid` / `manual`, with `total` backfilled from `subtotal` (no shipping was ever charged).
 *
 * Idempotent: only documents WITHOUT a `paymentStatus` are touched, so re-running does nothing and
 * a real PayMongo order is never rewritten. A no-op on an empty collection.
 *
 * Run it after filling in .env.local (see .env.example), before deploying the payment work.
 * It writes to the live Firestore project and there is no undo, so look before you leap:
 *
 *     npm run backfill:payments -- --dry-run   # report what would change, write nothing
 *     npm run backfill:payments                # actually write
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

const ORDERS = "storeOrders";
const DRY_RUN = process.argv.includes("--dry-run");

initializeApp({
  credential: cert({
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

async function main() {
  const snap = await db.collection(ORDERS).get();
  if (snap.empty) {
    console.log(`No documents in ${ORDERS} — nothing to backfill.`);
    return;
  }

  const stale = snap.docs.filter((d) => typeof d.data().paymentStatus !== "string");
  console.log(`${snap.size} order(s) found, ${stale.length} without a paymentStatus.`);
  if (stale.length === 0) return;

  // Name every document that would change. These get marked PAID — if one of them was never
  // actually settled, say so now: `paid` is terminal in applyOrderPayment and won't move back.
  console.log(DRY_RUN ? "\nWould mark as paid/manual:" : "\nMarking as paid/manual:");
  for (const doc of stale) {
    const d = doc.data();
    const when = typeof d.createdAt === "number" ? new Date(d.createdAt).toISOString() : "?";
    console.log(`  ${d.ref ?? doc.id}  ${when}  ${typeof d.subtotal === "number" ? d.subtotal : 0}`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run — nothing written. Re-run without --dry-run to apply.`);
    return;
  }

  // Firestore caps a batch at 500 writes; chunk rather than assume the collection is small.
  for (let i = 0; i < stale.length; i += 400) {
    const chunk = stale.slice(i, i + 400);
    const batch = db.batch();
    for (const doc of chunk) {
      const subtotal = typeof doc.data().subtotal === "number" ? doc.data().subtotal : 0;
      batch.update(doc.ref, {
        paymentStatus: "paid",
        paymentMethod: "manual",
        shippingFee: 0,
        total: subtotal,
        checkoutSessionId: "",
        checkoutUrl: "",
        paidAt: typeof doc.data().createdAt === "number" ? doc.data().createdAt : Date.now(),
        paymentError: "",
      });
    }
    await batch.commit();
    console.log(`  committed ${chunk.length} update(s)`);
  }

  console.log(`Backfilled ${stale.length} order(s) as paid/manual.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
