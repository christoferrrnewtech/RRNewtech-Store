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
import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, storeDoc, DOCS } from "@/lib/firebase";
import { type Product, brandProductSlugify } from "@/lib/products";
import type { BrandGroup } from "@/lib/constants";

export type BrandStatus = "draft" | "published";

export type GalleryImage = { src: string; caption?: string };
export type BrandReason = { title: string; body: string };

/** A product owned by a brand and shown on its storefront page (with its own detail page). */
export type BrandProduct = {
  /** Stable key within the brand. */
  id: string;
  /** URL slug for the detail page, slugified from the name and deduped within the brand. Legacy
   *  products saved before this existed have none — the detail page falls back to matching `id`. */
  slug?: string;
  name: string;
  /** Price in PHP (whole pesos). */
  price: number;
  /** Optional original price for a sale (kept only when > price). */
  compareAtPrice?: number;
  summary?: string;
  /** Full description paragraphs for the detail page. */
  description?: string[];
  /** Spec/feature highlight bullets for the detail page. */
  highlights?: string[];
  /** Extra product photos shown on the detail page (beyond the main `image`). */
  gallery?: GalleryImage[];
  /** Uploaded image URL, or "" — the brand logo is used as a fallback. */
  image: string;
  inStock: boolean;
  /** When true, the storefront hides the price and shows a "Contact a sales agent" CTA instead. */
  contactSales?: boolean;
};

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
  /** Products owned by this brand, shown on its storefront page. */
  products: BrandProduct[];
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
// Each store document holds a map keyed by the natural id (banner id / slug / uid). These read the
// whole map and turn map values into typed objects, ignoring any stray non-object fields.
// ─────────────────────────────────────────────────────────────────────────────

type ItemMap = Record<string, Record<string, unknown>>;

/** Read the map inside a store document. Non-object values are dropped. */
async function readMap(name: string): Promise<ItemMap> {
  const snap = await storeDoc(name).get();
  const data = (snap.exists ? snap.data() : undefined) ?? {};
  const out: ItemMap = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = value as Record<string, unknown>;
    }
  }
  return out;
}

function toBanner(id: string, v: Record<string, unknown>): Banner {
  return {
    id,
    image: String(v.image ?? ""),
    alt: String(v.alt ?? ""),
    href: String(v.href ?? ""),
    order: typeof v.order === "number" ? v.order : 0,
  };
}

function toBrand(slug: string, v: Record<string, unknown>): Brand {
  const raw = Array.isArray(v.products) ? (v.products as BrandProduct[]) : [];
  // Slugs are always derived from the current product name (deduped within the brand), so a URL can
  // never drift from a renamed product. This overrides any stored/legacy slug on read.
  const used = new Set<string>();
  const products = raw.map((p) => {
    let s = brandProductSlugify(p.name ?? "", p.id);
    if (used.has(s)) {
      let n = 2;
      while (used.has(`${s}-${n}`)) n++;
      s = `${s}-${n}`;
    }
    used.add(s);
    return { ...p, slug: s };
  });
  return {
    ...(v as Omit<Brand, "slug">),
    slug,
    products,
  };
}

function toUser(uid: string, v: Record<string, unknown>): AdminUser {
  return {
    uid,
    email: String(v.email ?? ""),
    name: String(v.name ?? ""),
    role: v.role === "admin" ? "admin" : "marketing",
    brandSlugs: Array.isArray(v.brandSlugs) ? (v.brandSlugs as string[]) : [],
  };
}

/** Item payload to store under its id key — the id itself lives in the map key, not the value. */
function brandItem(brand: Brand) {
  const { slug, ...rest } = brand;
  void slug;
  return rest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storefront reads — published content only.
// ─────────────────────────────────────────────────────────────────────────────

/** Carousel banners in display order. */
export async function getBanners(): Promise<Banner[]> {
  const map = await readMap(DOCS.banner);
  return Object.entries(map)
    .map(([id, v]) => toBanner(id, v))
    .sort((a, b) => a.order - b.order);
}

/** Published brands in display order. This is what the storefront should always call. */
export async function getBrands(): Promise<Brand[]> {
  const map = await readMap(DOCS.brand);
  return Object.entries(map)
    .map(([slug, v]) => toBrand(slug, v))
    .filter((b) => b.status === "published")
    .sort((a, b) => a.order - b.order);
}

/** Published brand by slug, or undefined — drafts are invisible here on purpose. */
export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  const map = await readMap(DOCS.brand);
  if (!map[slug]) return undefined;
  const brand = toBrand(slug, map[slug]);
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

// ─────────────────────────────────────────────────────────────────────────────
// Admin reads — include drafts. Never call these from a storefront page.
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllBrandsForAdmin(): Promise<Brand[]> {
  const map = await readMap(DOCS.brand);
  return Object.entries(map)
    .map(([slug, v]) => toBrand(slug, v))
    .sort((a, b) => a.order - b.order);
}

export async function getBrandForAdmin(slug: string): Promise<Brand | undefined> {
  const map = await readMap(DOCS.brand);
  return map[slug] ? toBrand(slug, map[slug]) : undefined;
}

export async function brandExists(slug: string): Promise<boolean> {
  const map = await readMap(DOCS.brand);
  return Boolean(map[slug]);
}

export async function getUsers(): Promise<AdminUser[]> {
  const map = await readMap(DOCS.users);
  return Object.entries(map)
    .map(([uid, v]) => toUser(uid, v))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserByEmail(email: string): Promise<AdminUser | undefined> {
  const needle = email.trim().toLowerCase();
  return (await getUsers()).find((u) => u.email.toLowerCase() === needle);
}

export async function getUserByUid(uid: string): Promise<AdminUser | undefined> {
  const map = await readMap(DOCS.users);
  return map[uid] ? toUser(uid, map[uid]) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin writes. Each write targets one map key inside the type's document.
// ─────────────────────────────────────────────────────────────────────────────

export async function addBanner(data: Omit<Banner, "id" | "order">): Promise<void> {
  const id = crypto.randomUUID();
  const existing = await getBanners();
  await storeDoc(DOCS.banner).set(
    { [id]: { ...data, order: existing.length } },
    { merge: true },
  );
}

export async function updateBanner(
  id: string,
  patch: Partial<Omit<Banner, "id" | "order">>,
): Promise<void> {
  // Nested merge updates only the supplied fields of this banner, leaving the rest intact.
  await storeDoc(DOCS.banner).set({ [id]: patch }, { merge: true });
}

export async function deleteBanner(id: string): Promise<void> {
  await storeDoc(DOCS.banner).update({ [id]: FieldValue.delete() });
}

/** Write the carousel order from a full id sequence. Ids not listed keep their old order. */
export async function reorderBanners(ids: string[]): Promise<void> {
  const updates: Record<string, number> = {};
  ids.forEach((id, order) => {
    updates[`${id}.order`] = order;
  });
  if (Object.keys(updates).length) await storeDoc(DOCS.banner).update(updates);
}

export async function createBrand(brand: Brand): Promise<void> {
  await storeDoc(DOCS.brand).set({ [brand.slug]: brandItem(brand) }, { merge: true });
}

/**
 * Persist a full brand (used by every brand-section save). `update` replaces the whole item value,
 * so fields cleared in the editor (e.g. a removed hero image) are actually dropped.
 */
export async function saveBrand(brand: Brand): Promise<void> {
  await storeDoc(DOCS.brand).update({ [brand.slug]: brandItem(brand) });
}

export async function deleteBrand(slug: string): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  batch.update(storeDoc(DOCS.brand), { [slug]: FieldValue.delete() });
  // Drop the deleted brand from any marketing user's assignments.
  const users = await readMap(DOCS.users);
  for (const [uid, v] of Object.entries(users)) {
    if (Array.isArray(v.brandSlugs) && (v.brandSlugs as string[]).includes(slug)) {
      batch.update(storeDoc(DOCS.users), { [`${uid}.brandSlugs`]: FieldValue.arrayRemove(slug) });
    }
  }
  await batch.commit();
}

/** Next display order for a new brand (count of existing brands). */
export async function nextBrandOrder(): Promise<number> {
  const map = await readMap(DOCS.brand);
  return Object.keys(map).length;
}

/** Write brand display order from a full slug sequence (position = order). */
export async function reorderBrands(slugs: string[]): Promise<void> {
  const updates: Record<string, number> = {};
  slugs.forEach((slug, order) => {
    updates[`${slug}.order`] = order;
  });
  if (Object.keys(updates).length) await storeDoc(DOCS.brand).update(updates);
}

export async function upsertAdminUser(user: AdminUser): Promise<void> {
  const { uid, ...rest } = user;
  await storeDoc(DOCS.users).set({ [uid]: rest }, { merge: true });
}

export async function updateUserBrands(uid: string, brandSlugs: string[]): Promise<void> {
  await storeDoc(DOCS.users).update({ [`${uid}.brandSlugs`]: brandSlugs });
}

export async function deleteAdminUserDoc(uid: string): Promise<void> {
  await storeDoc(DOCS.users).update({ [uid]: FieldValue.delete() });
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
