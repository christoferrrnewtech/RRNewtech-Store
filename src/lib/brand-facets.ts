import type { BrandProduct, StoreCategory } from "@/lib/content";

export type Facet = { value: string; label: string; count: number };
export type CategoryFacet = Facet & { subs: Facet[] };

/**
 * What the brand-page filter should render. A discriminated union so the component can't
 * accidentally draw a row that doesn't apply to this brand.
 */
export type BrandFacets =
  | { mode: "none" }
  | { mode: "categories"; categories: CategoryFacet[] }
  | { mode: "subcategories"; subcategories: Facet[] };

/**
 * Decides how a brand's product grid can be filtered, if at all.
 *
 * Brands vary wildly: some carry three categories across six products, others one category across
 * twenty-seven. A fixed shape would give most brands a single chip that can't filter anything, so
 * this adapts:
 *
 *   - 2+ categories  → category chips, each drilling into its own subcategories
 *   - exactly 1      → skip the pointless parent row, show its subcategories directly
 *   - otherwise      → no filter
 *
 * Chips appear as soon as there are two to choose between, however few products carry tags —
 * partial tagging should show visible progress rather than nothing. Untagged products stay
 * reachable under "All".
 */
export function brandProductFacets(
  products: BrandProduct[],
  categories: StoreCategory[],
): BrandFacets {
  if (products.length === 0) return { mode: "none" };

  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));
  // Subcategory slugs are only unique within a category, so key on "category/subcategory".
  const subName = new Map<string, string>(
    categories.flatMap((c) =>
      c.subcategories.map((s): [string, string] => [`${c.slug}/${s.slug}`, s.name]),
    ),
  );

  // Group products by category, and within each by subcategory.
  const grouped = new Map<string, { count: number; subs: Map<string, number> }>();
  for (const p of products) {
    if (!p.category) continue;
    let entry = grouped.get(p.category);
    if (!entry) {
      entry = { count: 0, subs: new Map() };
      grouped.set(p.category, entry);
    }
    entry.count++;
    if (p.subcategory) {
      const key = `${p.category}/${p.subcategory}`;
      entry.subs.set(key, (entry.subs.get(key) ?? 0) + 1);
    }
  }

  const byCount = (a: Facet, b: Facet) => b.count - a.count || a.label.localeCompare(b.label);

  const facets: CategoryFacet[] = [...grouped.entries()]
    .map(([slug, entry]) => ({
      value: slug,
      label: categoryName.get(slug) ?? slug,
      count: entry.count,
      subs: [...entry.subs.entries()]
        .map(([key, count]) => ({
          value: key,
          label: subName.get(key) ?? key.split("/")[1],
          count,
        }))
        .sort(byCount),
    }))
    .sort(byCount);

  if (facets.length >= 2) return { mode: "categories", categories: facets };

  // One category: its own chip would filter nothing, so promote its subcategories to the top row.
  const only = facets[0];
  if (only && only.subs.length >= 2) {
    return { mode: "subcategories", subcategories: only.subs };
  }

  return { mode: "none" };
}

/** The value a product is filed under for `axis` — must match how brandProductFacets keys them. */
export function facetValue(
  product: BrandProduct,
  axis: "category" | "subcategory",
): string | undefined {
  if (axis === "category") return product.category;
  return product.category && product.subcategory
    ? `${product.category}/${product.subcategory}`
    : undefined;
}
