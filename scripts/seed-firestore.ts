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
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { PRODUCT_SEED, CATEGORIES, brandSlug, productImageUrl } from "../src/lib/products";

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

// Documents inside R&RLandingPage — one per type, each holding a map keyed by id/slug/uid.
const LANDING = "R&RLandingPage";
const DOCS = {
  banner: "banner",
  brand: "brand",
  product: "product",
  categories: "categories",
  users: "users",
} as const;
// The old top-level collections from the first (sibling) seed — removed at the end.
const OLD_COLLECTIONS = [
  "storeBanners",
  "storeBrands",
  "storeProducts",
  "storeCategories",
  "storeAdminUsers",
];

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

const storeDoc = (name: string) => db.collection(LANDING).doc(name);

type JsonBrand = { slug: string; [k: string]: unknown };
type JsonBanner = { id: string; image: string; alt: string; href: string };
type JsonUser = { email: string; name: string; role: "admin" | "marketing"; brandSlugs: string[] };
type SiteContent = { banners: JsonBanner[]; brands: JsonBrand[]; users: JsonUser[] };

const content = JSON.parse(
  readFileSync(join(ROOT, "data", "site-content.json"), "utf8"),
) as SiteContent;

async function seedBanners() {
  const map: Record<string, unknown> = {};
  content.banners.forEach((b, order) => {
    map[b.id] = { image: b.image, alt: b.alt, href: b.href, order };
  });
  // No merge: replaces the whole document (clears the old placeholder `banner: ""` field).
  await storeDoc(DOCS.banner).set(map);
  console.log(`✓ R&RLandingPage/banner: ${content.banners.length}`);
}

async function seedBrands() {
  const map: Record<string, unknown> = {};
  for (const brand of content.brands) {
    const { slug, featuredProductSlugs, ...rest } = brand as JsonBrand & {
      featuredProductSlugs?: string[];
    };
    void featuredProductSlugs; // replaced by brand-owned `products`

    // Seed each brand's products from the matching seed catalog entries (lightweight shape).
    const products = PRODUCT_SEED.filter((p) => brandSlug(p.brand) === slug).map((p) => ({
      id: p.slug,
      name: p.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      summary: p.summary,
      image: p.useBrandLogo ? "" : productImageUrl(p, 800),
      inStock: p.inStock,
    }));

    map[slug] = { ...rest, products };
  }
  await storeDoc(DOCS.brand).set(map);
  console.log(`✓ R&RLandingPage/brand: ${content.brands.length}`);
}

async function seedProducts() {
  const map: Record<string, unknown> = {};
  PRODUCT_SEED.forEach((p, order) => {
    const { slug, ...rest } = p;
    map[slug] = { ...rest, brandSlug: brandSlug(p.brand), order }; // brandSlug = FK to brand
  });
  await storeDoc(DOCS.product).set(map);
  console.log(`✓ R&RLandingPage/product: ${PRODUCT_SEED.length}`);
}

async function seedCategories() {
  const map: Record<string, unknown> = {};
  CATEGORIES.forEach((c, order) => {
    const { slug, ...rest } = c;
    map[slug] = { ...rest, order };
  });
  await storeDoc(DOCS.categories).set(map);
  console.log(`✓ R&RLandingPage/categories: ${CATEGORIES.length}`);
}

async function deleteOldCollections() {
  for (const name of OLD_COLLECTIONS) {
    await db.recursiveDelete(db.collection(name));
    console.log(`✓ removed old top-level collection: ${name}`);
  }
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
  const map: Record<string, unknown> = {};

  // 1. The owner account — same credentials the app used before.
  const ownerEmail = "admin@rnr.com";
  const ownerUid = await ensureAuthUser(ownerEmail, "rnr@123", "R&R Admin");
  map[ownerUid] = { email: ownerEmail, name: "R&R Admin", role: "admin", brandSlugs: [] };
  console.log(`✓ admin account: ${ownerEmail} / rnr@123`);

  // 2. Existing marketing users — new temp passwords (old scrypt hashes can't be migrated).
  for (const u of content.users) {
    if (u.email.toLowerCase() === ownerEmail) continue;
    const tempPassword = `rrnt-${crypto.randomBytes(4).toString("hex")}`;
    const uid = await ensureAuthUser(u.email, tempPassword, u.name);
    map[uid] = {
      email: u.email.toLowerCase(),
      name: u.name,
      role: u.role,
      brandSlugs: u.brandSlugs ?? [],
    };
    console.log(`✓ ${u.role} account: ${u.email} — TEMP PASSWORD: ${tempPassword}`);
  }

  await storeDoc(DOCS.users).set(map);
}

async function main() {
  console.log(`Seeding Firestore project "${process.env.FIREBASE_PROJECT_ID}"…\n`);
  await seedBanners();
  await seedBrands();
  await seedProducts();
  await seedCategories();
  await seedUsers();
  await deleteOldCollections();
  console.log("\nDone. Set any temporary passwords above with their owners.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  },
);
