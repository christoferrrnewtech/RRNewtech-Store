/**
 * Cart line model + builders — CLIENT-SAFE.
 *
 * This module has no server-only imports, so both the Server Components that *produce* cart lines
 * (product cards, product pages) and the client cart store in `cart.tsx` can import from it.
 * The cart store itself is `"use client"`, so it can't hand these helpers back to a server
 * component — hence the split, same reasoning as `brands/[slug]/sections.ts`.
 *
 * The store carries TWO product models with independent id namespaces: catalog `Product` (keyed by
 * slug, from `R&RLandingPage/product`) and `BrandProduct` (keyed by id, nested under a brand). A
 * cart line records which one it came from so the two can never collide on a single key, and
 * stores its own `href` so the cart renders links without re-fetching either catalog.
 */

import { brandProductHref, CATEGORY_MAP, type Product } from "@/lib/products";
import type { BrandProduct } from "@/lib/content";

/** Highest quantity allowed on a single line. Keeps a stuck "+" from reaching absurd totals. */
export const MAX_QUANTITY = 99;

/** Which catalog a cart line came from. */
export type CartItemSource = "catalog" | "brand";

export type CartItem = {
  /** Collision-proof line key, `${source}:${id}` — the dedupe key for the whole cart. */
  key: string;
  /** Which catalog the line came from. The two have independent id namespaces. */
  source: CartItemSource;
  /** Natural id within the source: catalog `Product.slug`, or `BrandProduct.id`. */
  id: string;
  /** Canonical detail-page URL, stored so the cart links out without re-fetching. */
  href: string;
  name: string;
  /** Unit price in PHP (whole pesos) at the time it was added — see the price-drift note below. */
  price: number;
  /** Unit label ("box", "pc"); "" for brand products, which have none — render it conditionally. */
  unit: string;
  /** SKU for analytics attribution; falls back to the natural id when the source has no SKU. */
  sku: string;
  category: string;
  image: string;
  quantity: number;
};

/** A cart line before it enters the cart — the store supplies the quantity. */
export type NewCartItem = Omit<CartItem, "quantity">;

/** Clamp any incoming quantity to a whole number within [1, MAX_QUANTITY]. */
export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n)));
}

/**
 * Cart line for a catalog product (`/products/[slug]`).
 *
 * `category` carries the human-readable name rather than the slug — it is what analytics reports
 * on and what the cart would surface to a customer.
 */
export function catalogCartItem(product: Product, image: string): NewCartItem {
  return {
    key: `catalog:${product.slug}`,
    source: "catalog",
    id: product.slug,
    href: `/products/${product.slug}`,
    name: product.name,
    price: product.price,
    unit: product.unit,
    sku: product.sku,
    category: CATEGORY_MAP[product.category].name,
    image,
  };
}

/**
 * Cart line for a brand-owned product (`/brands/[slug]/[productSlug]`).
 *
 * Keyed on `product.id`, not its slug: `toBrand()` in `content.ts` re-derives the slug from the
 * product name on every read, so renaming a product in admin would silently change a slug-based
 * key and orphan the line. The slug lives in `href` instead, via the shared URL helper.
 */
export function brandCartItem(
  product: BrandProduct,
  brandSlugValue: string,
  brandName: string,
  image: string,
): NewCartItem {
  return {
    key: `brand:${product.id}`,
    source: "brand",
    id: product.id,
    href: brandProductHref(brandSlugValue, product),
    name: product.name,
    price: product.price,
    unit: "",
    // BrandProduct has no SKU field — the id is the stable identifier analytics can attribute on.
    sku: product.id,
    category: brandName,
    image,
  };
}

/**
 * Runtime guard for a persisted cart line.
 *
 * Cart data survives in localStorage indefinitely, so it outlives any given deploy: a line written
 * by an older build, hand-edited, or truncated must not reach render. A single item with a
 * non-numeric `price` would otherwise turn the subtotal into NaN and break the entire cart UI.
 */
export function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;

  return (
    isNonEmptyString(i.key) &&
    (i.source === "catalog" || i.source === "brand") &&
    isNonEmptyString(i.id) &&
    isNonEmptyString(i.href) &&
    (i.href as string).startsWith("/") &&
    isNonEmptyString(i.name) &&
    typeof i.price === "number" &&
    Number.isFinite(i.price) &&
    i.price >= 0 &&
    typeof i.unit === "string" &&
    typeof i.sku === "string" &&
    typeof i.category === "string" &&
    isNonEmptyString(i.image) &&
    typeof i.quantity === "number" &&
    Number.isInteger(i.quantity) &&
    i.quantity >= 1 &&
    i.quantity <= MAX_QUANTITY
  );
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}
