import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { CATEGORIES } from "@/lib/products";
import { getAllProducts } from "@/lib/catalog";
import { getBrands } from "@/lib/content";

/**
 * Dynamic sitemap — regenerates from the catalog so every product & category is discoverable.
 * Brands and products come from Firestore; if it isn't reachable (e.g. before credentials are
 * configured) the sitemap still lists the static + category routes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE.url}/discover`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE.url}/brands`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/shipping-returns`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE.url}/?category=${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  let brandRoutes: MetadataRoute.Sitemap = [];
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const [brands, products] = await Promise.all([getBrands(), getAllProducts()]);
    brandRoutes = brands.map((b) => ({
      url: `${SITE.url}/brands/${b.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
    productRoutes = products.map((p) => ({
      url: `${SITE.url}/products/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // Firestore unavailable — fall back to the static + category routes only.
  }

  return [...staticRoutes, ...categoryRoutes, ...brandRoutes, ...productRoutes];
}
