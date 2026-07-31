/**
 * One-off, NON-DESTRUCTIVE update of each brand's `logo` field in Firestore.
 *
 * The brand logos were re-cropped to 16:9 WebP and moved into `public/brand-logos/<slug>.webp`.
 * The storefront reads each brand's `logo` from the live `R&RLandingPage/brand` document, so the
 * path has to be repointed there. This script updates ONLY the `logo` field of each brand (a
 * dotted-field `update`), leaving products, `featuredOnHome`, status and everything else untouched
 * — unlike `npm run seed`, which rebuilds brands from PRODUCT_SEED and would wipe admin edits.
 *
 * Deploy the new `public/brand-logos/*.webp` files FIRST, then run:
 *
 *     npx tsx scripts/update-brand-logos.ts
 *
 * Needs the same service-account creds in `.env.local` that `npm run seed` uses
 * (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = process.cwd();

// ── Load .env.local into process.env (mirrors scripts/seed-firestore.ts) ─────────────────────
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

const LANDING = "R&RLandingPage";
const BRAND_DOC = "brand";

/** slug → new logo path. Keep in sync with public/brand-logos/ and data/site-content.json. */
const LOGOS: Record<string, string> = {
  curaprox: "/brand-logos/curaprox.webp",
  herculite: "/brand-logos/herculite.webp",
  kavoo: "/brand-logos/kavoo.webp",
  kerr: "/brand-logos/kerr.webp",
  lasotronix: "/brand-logos/lasotronix.webp",
  "philips-zoom": "/brand-logos/philips-zoom.webp",
  rundeer: "/brand-logos/rundeer.webp",
  "sol-laser": "/brand-logos/sol-laser.webp",
  sprintray: "/brand-logos/sprintray.webp",
};

async function main() {
  initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });

  const db = getFirestore();
  const ref = db.collection(LANDING).doc(BRAND_DOC);

  const snap = await ref.get();
  if (!snap.exists) throw new Error(`${LANDING}/${BRAND_DOC} does not exist.`);
  const data = snap.data() ?? {};

  // Only touch brands that actually exist in the document; warn about any mismatch.
  const updates: Record<string, string> = {};
  for (const [slug, path] of Object.entries(LOGOS)) {
    if (data[slug] && typeof data[slug] === "object") {
      updates[`${slug}.logo`] = path;
    } else {
      console.warn(`⚠ brand "${slug}" not found in Firestore — skipping.`);
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log("Nothing to update.");
    return;
  }

  await ref.update(updates);
  console.log(`✓ Updated ${Object.keys(updates).length} brand logo(s):`);
  for (const [field, path] of Object.entries(updates)) console.log(`  ${field} → ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
