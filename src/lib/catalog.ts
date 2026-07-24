/**
 * Product catalog reads — SERVER ONLY, Firestore-backed.
 *
 * Products live in a single document `R&RLandingPage/product`, holding a map keyed by product slug.
 * These async helpers replace the in-code query functions that used to live in `products.ts`; pages
 * that used `getAllProducts` etc. import them from here and `await` them.
 *
 * The pure, client-safe helpers (`brandSlug`, `productImageUrl`, `searchProducts`, `sortProducts`,
 * `CATEGORIES`, `CATEGORY_MAP`) still live in `products.ts` and are unaffected.
 *
 * The whole catalog is one document read, so every helper reads it once and filters in memory.
 */

import "server-only";
import { storeDoc, DOCS } from "@/lib/firebase";
import { brandSlug, type CategorySlug, type Product } from "@/lib/products";

type StoredProduct = Product & { order?: number };

/** Read every product from the `product` document's map, sorted by stored order then name. */
async function readProducts(): Promise<StoredProduct[]> {
  const snap = await storeDoc(DOCS.product).get();
  const data = (snap.exists ? snap.data() : undefined) ?? {};
  const list: StoredProduct[] = [];
  for (const [slug, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      list.push({ ...(v as StoredProduct), slug });
    }
  }
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

export async function getAllProducts(): Promise<Product[]> {
  return readProducts();
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return (await readProducts()).find((p) => p.slug === slug);
}

export async function getProductsByCategory(category: CategorySlug): Promise<Product[]> {
  return (await readProducts()).filter((p) => p.category === category);
}

export async function getProductsByBrand(slug: string): Promise<Product[]> {
  return (await readProducts()).filter((p) => brandSlug(p.brand) === slug);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  return (await readProducts()).filter((p) => p.featured).slice(0, limit);
}

/** Related products: same category, excluding the current one. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return (await readProducts())
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, limit);
}

/** Unique brands present in the catalog, sorted A–Z, with URL slugs. */
export async function getAllBrands(): Promise<{ name: string; slug: string }[]> {
  const products = await readProducts();
  const bySlug = new Map<string, string>();
  for (const p of products) bySlug.set(brandSlug(p.brand), p.brand);
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
