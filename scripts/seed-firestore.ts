/**
 * One-time migration: seed the `rnr-dental-clinics` Firestore project from the app's existing
 * in-code / JSON data. Safe to re-run — every write is an idempotent upsert keyed by the natural
 * id (banner id / brand slug / product slug / category slug / Firebase Auth uid).
 *
 * Run it after filling in .env.local (see .env.example):
 *
 *     npm run seed
 *
 * It writes: storeBanners, storeBrands, storeProducts, storeCategories, and creates the admin
 * accounts in Firebase Authentication + storeAdminUsers. Marketing users from the old JSON get a
 * freshly generated temporary password (the old scrypt hashes can't be migrated) — the script
 * prints those so you can pass them on.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { PRODUCT_SEED, CATEGORIES, brandSlug } from "../src/lib/products";

const ROOT = process.cwd();

// ── Load .env.local into process.env (so `npm run seed` needs no extra flags) ────────────────
function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    // Strip a single layer of surrounding quotes if present.
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}
loadEnvLocal();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — set it in .env.local (see .env.example).`);
  return v;
}

const COLLECTIONS = {
  banners: "storeBanners",
  brands: "storeBrands",
  products: "storeProducts",
  categories: "storeCategories",
  adminUsers: "storeAdminUsers",
} as const;

initializeApp({
  credential: cert({
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

type JsonBrand = { slug: string; [k: string]: unknown };
type JsonBanner = { id: string; image: string; alt: string; href: string };
type JsonUser = { email: string; name: string; role: "admin" | "marketing"; brandSlugs: string[] };
type SiteContent = { banners: JsonBanner[]; brands: JsonBrand[]; users: JsonUser[] };

const content = JSON.parse(
  readFileSync(join(ROOT, "data", "site-content.json"), "utf8"),
) as SiteContent;

async function seedBanners() {
  const batch = db.batch();
  content.banners.forEach((b, order) => {
    batch.set(db.collection(COLLECTIONS.banners).doc(b.id), {
      image: b.image,
      alt: b.alt,
      href: b.href,
      order,
    });
  });
  await batch.commit();
  console.log(`✓ storeBanners: ${content.banners.length}`);
}

async function seedBrands() {
  const batch = db.batch();
  for (const brand of content.brands) {
    const { slug, ...rest } = brand;
    batch.set(db.collection(COLLECTIONS.brands).doc(slug), {
      ...rest,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`✓ storeBrands: ${content.brands.length}`);
}

async function seedProducts() {
  const batch = db.batch();
  PRODUCT_SEED.forEach((p, order) => {
    const { slug, ...rest } = p;
    batch.set(db.collection(COLLECTIONS.products).doc(slug), {
      ...rest,
      brandSlug: brandSlug(p.brand), // real foreign key to storeBrands
      order,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log(`✓ storeProducts: ${PRODUCT_SEED.length}`);
}

async function seedCategories() {
  const batch = db.batch();
  CATEGORIES.forEach((c, order) => {
    const { slug, ...rest } = c;
    batch.set(db.collection(COLLECTIONS.categories).doc(slug), { ...rest, order });
  });
  await batch.commit();
  console.log(`✓ storeCategories: ${CATEGORIES.length}`);
}

/** Create (or update the password of) a Firebase Auth user; returns its uid. */
async function ensureAuthUser(email: string, password: string, name: string): Promise<string> {
  try {
    const u = await auth.createUser({ email, password, displayName: name });
    return u.uid;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      await auth.updateUser(existing.uid, { password, displayName: name });
      return existing.uid;
    }
    throw err;
  }
}

async function seedUsers() {
  // 1. The owner account — same credentials the app used before.
  const ownerEmail = "admin@rnr.com";
  const ownerUid = await ensureAuthUser(ownerEmail, "rnr@123", "R&R Admin");
  await db.collection(COLLECTIONS.adminUsers).doc(ownerUid).set({
    email: ownerEmail,
    name: "R&R Admin",
    role: "admin",
    brandSlugs: [],
  });
  console.log(`✓ admin account: ${ownerEmail} / rnr@123`);

  // 2. Existing marketing users — new temp passwords (old scrypt hashes can't be migrated).
  for (const u of content.users) {
    if (u.email.toLowerCase() === ownerEmail) continue;
    const tempPassword = `rrnt-${crypto.randomBytes(4).toString("hex")}`;
    const uid = await ensureAuthUser(u.email, tempPassword, u.name);
    await db.collection(COLLECTIONS.adminUsers).doc(uid).set({
      email: u.email.toLowerCase(),
      name: u.name,
      role: u.role,
      brandSlugs: u.brandSlugs ?? [],
    });
    console.log(`✓ ${u.role} account: ${u.email} — TEMP PASSWORD: ${tempPassword}`);
  }
}

async function main() {
  console.log(`Seeding Firestore project "${process.env.FIREBASE_PROJECT_ID}"…\n`);
  await seedBanners();
  await seedBrands();
  await seedProducts();
  await seedCategories();
  await seedUsers();
  console.log("\nDone. Set any temporary passwords above with their owners.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  },
);
