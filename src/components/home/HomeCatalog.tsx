import { Container } from "@/components/ui/Container";
import { AllProductsGrid } from "@/components/home/AllProductsGrid";
import { CatalogFilters } from "@/components/home/CatalogFilters";
import { getBrands, getCategoriesWithProducts } from "@/lib/content";

/** Non-default sorts the grid understands. "featured" is the unset state (curated brand order). */
export type CatalogSort = "price-asc" | "price-desc" | "quote-first";
const SORTS = new Set<string>(["price-asc", "price-desc", "quote-first"]);

/** A price bound is only honoured when it parses to a non-negative whole number. */
function bound(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The homepage catalog section: header + the Category/Brand/Price/Sort filter row over one flat
 * product grid, narrowed to whatever is filtered.
 *
 * Params are validated here rather than in the page: the filters run on the admin-managed brand
 * catalog, whose category slugs are a different vocabulary from the legacy CATEGORY_MAP the page
 * validates `?category=` against for its search-results view.
 */
export async function HomeCatalog({
  category,
  brand,
  min,
  max,
  sort,
}: {
  category?: string;
  brand?: string;
  min?: string;
  max?: string;
  sort?: string;
}) {
  const [categoryList, brandList] = await Promise.all([
    getCategoriesWithProducts().catch(() => []),
    getBrands().catch(() => []),
  ]);

  // Only offer brands that actually have something to show.
  const brandOptions = brandList
    .filter((b) => b.products.length > 0)
    .map((b) => ({ slug: b.slug, name: b.name }));
  const categoryOptions = categoryList.map((c) => ({ slug: c.slug, name: c.name }));

  // An unrecognized param is treated as unset, so a hand-edited URL degrades to "no filter"
  // instead of an empty grid.
  const activeCategory = categoryOptions.some((c) => c.slug === category) ? category : undefined;
  const activeBrand = brandOptions.some((b) => b.slug === brand) ? brand : undefined;
  const activeMin = bound(min);
  const activeMax = bound(max);
  const activeSort = sort && SORTS.has(sort) ? (sort as CatalogSort) : undefined;

  // Mix brands together unless the visitor asked for a specific ordering — a brand filter or an
  // explicit sort IS the requested order, so interleaving would fight it.
  const mix = !activeBrand && !activeSort;

  return (
    <section id="catalog" className="scroll-mt-24 bg-surface lg:scroll-mt-36">
      <Container className="py-14">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Shop</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
            Browse Products
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Filter by category, brand or price to find what your clinic needs.
          </p>
        </div>

        <div className="mb-8">
          <CatalogFilters
            categories={categoryOptions}
            brands={brandOptions}
            category={activeCategory}
            brand={activeBrand}
            min={activeMin}
            max={activeMax}
            sort={activeSort}
          />
        </div>

        <AllProductsGrid
          category={activeCategory}
          brand={activeBrand}
          min={activeMin}
          max={activeMax}
          sort={activeSort}
          mix={mix}
        />
      </Container>
    </section>
  );
}
