/**
 * Product catalog reads — SERVER ONLY, Firestore-backed.
 *
 * These are the async replacements for the in-code query helpers that used to live in
 * `products.ts`. They read the `storeProducts` collection in the `rnr-dental-clinics` project.
 * Pages/components that used `getAllProducts` etc. import them from here now and `await` them.
 *
 * The pure, client-safe helpers (`brandSlug`, `productImageUrl`, `searchProducts`, `sortProducts`,
 * `CATEGORIES`, `CATEGORY_MAP`) still live in `products.ts` and are unaffected.
 *
 * Collections are tiny (tens of docs), so we fetch with a single-field filter and sort in memory —
 * that keeps Firestore from ever needing a composite index.
 */

import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase";
import { brandSlug, type CategorySlug, type Product } from "@/lib/products";

function toProduct(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Product {
  // The doc stores every Product field; `order`/`updatedAt` are storage-only and dropped here.
  const data = doc.data() as Product & { order?: number; updatedAt?: unknown };
  const { order, updatedAt, ...rest } = data;
  void order;
  void updatedAt;
  return { ...(rest as Product), slug: doc.id };
}

function byOrderThenName(a: Product & { order?: number }, b: Product & { order?: number }): number {
  const ao = (a as { order?: number }).order ?? 0;
  const bo = (b as { order?: number }).order ?? 0;
  return ao - bo || a.name.localeCompare(b.name);
}

async function allDocs(): Promise<(Product & { order?: number })[]> {
  const snap = await getDb().collection(COLLECTIONS.products).get();
  return snap.docs
    .map((d) => ({ ...toProduct(d), order: (d.data() as { order?: number }).order ?? 0 }))
    .sort(byOrderThenName);
}

export async function getAllProducts(): Promise<Product[]> {
  return allDocs();
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const doc = await getDb().collection(COLLECTIONS.products).doc(slug).get();
  return doc.exists ? toProduct(doc) : undefined;
}

export async function getProductsByCategory(category: CategorySlug): Promise<Product[]> {
  const snap = await getDb()
    .collection(COLLECTIONS.products)
    .where("category", "==", category)
    .get();
  return snap.docs
    .map((d) => ({ ...toProduct(d), order: (d.data() as { order?: number }).order ?? 0 }))
    .sort(byOrderThenName);
}

export async function getProductsByBrand(slug: string): Promise<Product[]> {
  const snap = await getDb()
    .collection(COLLECTIONS.products)
    .where("brandSlug", "==", slug)
    .get();
  return snap.docs
    .map((d) => ({ ...toProduct(d), order: (d.data() as { order?: number }).order ?? 0 }))
    .sort(byOrderThenName);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const snap = await getDb()
    .collection(COLLECTIONS.products)
    .where("featured", "==", true)
    .get();
  return snap.docs
    .map((d) => ({ ...toProduct(d), order: (d.data() as { order?: number }).order ?? 0 }))
    .sort(byOrderThenName)
    .slice(0, limit);
}

/** Related products: same category, excluding the current one. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const list = await getProductsByCategory(product.category);
  return list.filter((p) => p.slug !== product.slug).slice(0, limit);
}

/** Unique brands present in the catalog, sorted A–Z, with URL slugs. */
export async function getAllBrands(): Promise<{ name: string; slug: string }[]> {
  const products = await allDocs();
  const bySlug = new Map<string, string>();
  for (const p of products) bySlug.set(brandSlug(p.brand), p.brand);
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
