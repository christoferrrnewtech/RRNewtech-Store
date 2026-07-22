/**
 * Editable site content — the data the /admin area writes and the storefront reads.
 *
 * SERVER ONLY. This module touches the filesystem, so it must never be imported from a
 * "use client" component (or from `@/lib/products`, which client components do import).
 * Client components receive brand data as props from a server layout/page instead.
 *
 * PHASE 1 (now): a JSON file on disk. Reads are synchronous with a module-level cache so every
 * helper below stays synchronous and call sites read like plain data access.
 * PHASE 4: swap the read/write pair for Firestore behind these same helper signatures.
 */

import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, brandSlug, type Product } from "@/lib/products";

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

export type Banner = { image: string; alt: string; href: string };

export type UserRole = "admin" | "marketing";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** scrypt hash + salt, both hex. Never sent to the client. */
  passwordHash: string;
  salt: string;
  /** Brands a marketing user may edit. Ignored for admins (they get everything). */
  brandSlugs: string[];
};

export type SiteContent = { banner: Banner; brands: Brand[]; users: AdminUser[] };

const CONTENT_PATH = path.join(process.cwd(), "data", "site-content.json");

let cache: SiteContent | null = null;

/** Full content document. Cached until a write invalidates it. */
export function getContent(): SiteContent {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(CONTENT_PATH, "utf8")) as SiteContent;
  }
  return cache;
}

/** Persist the document. Writes to a temp file first so a crash can't truncate the real one. */
export function saveContent(next: SiteContent): void {
  const tmp = `${CONTENT_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, CONTENT_PATH);
  cache = next;
}

/** Read, mutate in place, save. The callback gets a deep copy, so a throw leaves disk untouched. */
export function updateContent(mutate: (draft: SiteContent) => void): SiteContent {
  const draft = structuredClone(getContent());
  mutate(draft);
  saveContent(draft);
  return draft;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storefront reads — published content only.
// ─────────────────────────────────────────────────────────────────────────────

export function getBanner(): Banner {
  return getContent().banner;
}

/** Published brands in display order. This is what the storefront should always call. */
export function getBrands(): Brand[] {
  return getContent()
    .brands.filter((b) => b.status === "published")
    .sort((a, b) => a.order - b.order);
}

/** Published brand by slug, or undefined — drafts are invisible here on purpose. */
export function getBrandBySlug(slug: string): Brand | undefined {
  return getBrands().find((b) => b.slug === slug);
}

/**
 * Brand wordmark to show in place of a product photo, for products flagged `useBrandLogo`.
 * Callers render it contained on a white plate — these logos carry their own backgrounds.
 */
export function productBrandLogo(product: Product): string | undefined {
  if (!product.useBrandLogo) return undefined;
  return getBrandBySlug(brandSlug(product.brand))?.logo;
}

/** Featured products for a brand, resolved and de-duplicated. Unknown slugs are dropped. */
export function getFeaturedProductsForBrand(brand: Brand): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const slug of brand.featuredProductSlugs) {
    if (seen.has(slug)) continue;
    const product = PRODUCTS.find((p) => p.slug === slug);
    if (product) {
      seen.add(slug);
      out.push(product);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin reads — include drafts. Never call these from a storefront page.
// ─────────────────────────────────────────────────────────────────────────────

export function getAllBrandsForAdmin(): Brand[] {
  return [...getContent().brands].sort((a, b) => a.order - b.order);
}

export function getBrandForAdmin(slug: string): Brand | undefined {
  return getContent().brands.find((b) => b.slug === slug);
}

export function getUsers(): AdminUser[] {
  return getContent().users;
}

export function getUserByEmail(email: string): AdminUser | undefined {
  const needle = email.trim().toLowerCase();
  return getContent().users.find((u) => u.email.toLowerCase() === needle);
}

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
