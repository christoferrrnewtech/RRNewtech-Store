/**
 * Editable site content — the data the /admin area writes and the storefront reads.
 *
 * SERVER ONLY. This module talks to Firestore (via `@/lib/firebase`), so it must never be
 * imported from a `"use client"` component. Client components receive brand data as props from a
 * server layout/page instead.
 *
 * Data lives in three prefixed, top-level ("sibling") collections in the `rnr-dental-clinics`
 * project, alongside the existing `R&RLandingPage` collection:
 *   storeBanners/{id}      storeBrands/{slug}      storeAdminUsers/{uid}
 *
 * All reads/writes are async (Firestore). The helper *names* match the previous file-backed
 * version so call sites only had to add `await`.
 */

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase";
import { getProductBySlug } from "@/lib/catalog";
import { type Product } from "@/lib/products";
import type { BrandGroup } from "@/lib/constants";

export type BrandStatus = "draft" | "published";

export type GalleryImage = { src: string; caption?: string };
export type BrandReason = { title: string; body: string };

export type BrandCta = {
  heading: string;
  body: string;
  buttonLabel: string;
  /** Official manufacturer site. Empty string hides the button. */
  websiteUrl: string;
};

export type Brand = {
  slug: string;
  name: string;
  /** Drafts are hidden from the storefront entirely — not listed, and the page 404s. */
  status: BrandStatus;
  /** Display order in the Brand Showcase and /brands index. */
  order: number;
  /** Category grouping — drives the card tag chip and the "Shop by Brand" filter chips. */
  group: BrandGroup;
  /** One line on the brand card. */
  tagline: string;
  /** 1–2 sentences under the hero (also the meta description). */
  blurb: string;
  /** Wide hero image across the top of the brand page. Optional. */
  heroImage?: string;
  /** Brand wordmark. These carry their own backgrounds, so always render contained on white. */
  logo: string;
  /** "About the Brand" body paragraphs. */
  about: string[];
  /** Any YouTube URL; the embed id is parsed out at render time. */
  youtubeUrl?: string;
  gallery: GalleryImage[];
  /** Product slugs to feature. Unknown slugs are ignored at read time. */
  featuredProductSlugs: string[];
  /** "Why Choose This Brand?" cards. */
  whyChoose: BrandReason[];
  cta: BrandCta;
};

export type Banner = { id: string; image: string; alt: string; href: string; order: number };

export type UserRole = "admin" | "marketing";

/**
 * Admin user profile. Credentials are held by Firebase Authentication — this doc only carries
 * identity + authorization. `uid` is the Firebase Auth uid and the Firestore document id.
 */
export type AdminUser = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  /** Brands a marketing user may edit. Ignored for admins (they get everything). */
  brandSlugs: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Firestore converters. Document id carries the natural key (banner id / brand slug / uid),
// so it isn't duplicated inside the stored fields.
// ─────────────────────────────────────────────────────────────────────────────

type Doc = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;

function toBanner(doc: Doc): Banner {
  const d = doc.data() as Omit<Banner, "id">;
  return { id: doc.id, image: d.image, alt: d.alt, href: d.href, order: d.order ?? 0 };
}

function toBrand(doc: Doc): Brand {
  const { slug, ...rest } = doc.data() as Brand & { updatedAt?: unknown };
  void slug; // slug comes from the document id, not the stored fields
  return { ...(rest as Omit<Brand, "slug">), slug: doc.id };
}

function toUser(doc: Doc): AdminUser {
  const d = doc.data() as Omit<AdminUser, "uid">;
  return {
    uid: doc.id,
    email: d.email,
    name: d.name,
    role: d.role,
    brandSlugs: Array.isArray(d.brandSlugs) ? d.brandSlugs : [],
  };
}

/** Strip the id-carrying key and stamp updatedAt before writing a brand document. */
function brandToDoc(brand: Brand) {
  const { slug, ...rest } = brand;
  void slug; // stored as the document id, not a field
  return { ...rest, updatedAt: FieldValue.serverTimestamp() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storefront reads — published content only.
// ─────────────────────────────────────────────────────────────────────────────

/** Carousel banners in display order. */
export async function getBanners(): Promise<Banner[]> {
  const snap = await getDb().collection(COLLECTIONS.banners).get();
  return snap.docs.map(toBanner).sort((a, b) => a.order - b.order);
}

/** Published brands in display order. This is what the storefront should always call. */
export async function getBrands(): Promise<Brand[]> {
  const snap = await getDb().collection(COLLECTIONS.brands).get();
  return snap.docs
    .map(toBrand)
    .filter((b) => b.status === "published")
    .sort((a, b) => a.order - b.order);
}

/** Published brand by slug, or undefined — drafts are invisible here on purpose. */
export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  const doc = await getDb().collection(COLLECTIONS.brands).doc(slug).get();
  if (!doc.exists) return undefined;
  const brand = toBrand(doc);
  return brand.status === "published" ? brand : undefined;
}

/**
 * Brand wordmark to show in place of a product photo, for products flagged `useBrandLogo`.
 * Callers render it contained on a white plate — these logos carry their own backgrounds.
 */
export async function productBrandLogo(product: Product): Promise<string | undefined> {
  if (!product.useBrandLogo) return undefined;
  const { brandSlug } = await import("@/lib/products");
  return (await getBrandBySlug(brandSlug(product.brand)))?.logo;
}

/** Featured products for a brand, resolved and de-duplicated. Unknown slugs are dropped. */
export async function getFeaturedProductsForBrand(brand: Brand): Promise<Product[]> {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const slug of brand.featuredProductSlugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const product = await getProductBySlug(slug);
    if (product) out.push(product);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin reads — include drafts. Never call these from a storefront page.
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllBrandsForAdmin(): Promise<Brand[]> {
  const snap = await getDb().collection(COLLECTIONS.brands).get();
  return snap.docs.map(toBrand).sort((a, b) => a.order - b.order);
}

export async function getBrandForAdmin(slug: string): Promise<Brand | undefined> {
  const doc = await getDb().collection(COLLECTIONS.brands).doc(slug).get();
  return doc.exists ? toBrand(doc) : undefined;
}

export async function brandExists(slug: string): Promise<boolean> {
  const doc = await getDb().collection(COLLECTIONS.brands).doc(slug).get();
  return doc.exists;
}

export async function getUsers(): Promise<AdminUser[]> {
  const snap = await getDb().collection(COLLECTIONS.adminUsers).get();
  return snap.docs.map(toUser).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserByEmail(email: string): Promise<AdminUser | undefined> {
  const needle = email.trim().toLowerCase();
  const snap = await getDb()
    .collection(COLLECTIONS.adminUsers)
    .where("email", "==", needle)
    .limit(1)
    .get();
  return snap.empty ? undefined : toUser(snap.docs[0]);
}

export async function getUserByUid(uid: string): Promise<AdminUser | undefined> {
  const doc = await getDb().collection(COLLECTIONS.adminUsers).doc(uid).get();
  return doc.exists ? toUser(doc) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin writes.
// ─────────────────────────────────────────────────────────────────────────────

export async function addBanner(data: Omit<Banner, "id" | "order">): Promise<void> {
  const db = getDb();
  const existing = await getBanners();
  const order = existing.length; // append to the end of the carousel
  await db.collection(COLLECTIONS.banners).add({ ...data, order });
}

export async function updateBanner(
  id: string,
  patch: Partial<Omit<Banner, "id" | "order">>,
): Promise<void> {
  await getDb().collection(COLLECTIONS.banners).doc(id).set(patch, { merge: true });
}

export async function deleteBanner(id: string): Promise<void> {
  await getDb().collection(COLLECTIONS.banners).doc(id).delete();
}

/** Write the carousel order from a full id sequence. Ids not listed keep their old order. */
export async function reorderBanners(ids: string[]): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  ids.forEach((id, order) => {
    batch.set(db.collection(COLLECTIONS.banners).doc(id), { order }, { merge: true });
  });
  await batch.commit();
}

export async function createBrand(brand: Brand): Promise<void> {
  await getDb().collection(COLLECTIONS.brands).doc(brand.slug).set(brandToDoc(brand));
}

/** Persist a full brand document (used by every brand-section save). */
export async function saveBrand(brand: Brand): Promise<void> {
  await getDb().collection(COLLECTIONS.brands).doc(brand.slug).set(brandToDoc(brand));
}

export async function deleteBrand(slug: string): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.brands).doc(slug));
  // Drop the deleted brand from any marketing user's assignments.
  const users = await db
    .collection(COLLECTIONS.adminUsers)
    .where("brandSlugs", "array-contains", slug)
    .get();
  for (const u of users.docs) {
    batch.update(u.ref, { brandSlugs: FieldValue.arrayRemove(slug) });
  }
  await batch.commit();
}

/** Next display order for a new brand (count of existing brands). */
export async function nextBrandOrder(): Promise<number> {
  const snap = await getDb().collection(COLLECTIONS.brands).get();
  return snap.size;
}

export async function upsertAdminUser(user: AdminUser): Promise<void> {
  const { uid, ...rest } = user;
  await getDb().collection(COLLECTIONS.adminUsers).doc(uid).set(rest, { merge: true });
}

export async function updateUserBrands(uid: string, brandSlugs: string[]): Promise<void> {
  await getDb().collection(COLLECTIONS.adminUsers).doc(uid).set({ brandSlugs }, { merge: true });
}

export async function deleteAdminUserDoc(uid: string): Promise<void> {
  await getDb().collection(COLLECTIONS.adminUsers).doc(uid).delete();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility (pure).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a YouTube video id from any of the usual URL shapes (watch, youtu.be, embed, shorts).
 * Returns undefined for anything unrecognised so the section is simply skipped.
 */
export function youtubeEmbedId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : undefined;
}
