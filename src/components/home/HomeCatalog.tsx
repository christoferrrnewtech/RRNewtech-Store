import { Container } from "@/components/ui/Container";
import { AllProductsGrid } from "@/components/home/AllProductsGrid";
import { CatalogFilters } from "@/components/home/CatalogFilters";
import { CatalogToolbar } from "@/components/home/CatalogToolbar";
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
 * The catalog: header + the Category/Brand/Price/Sort filter row over one flat product grid,
 * narrowed to whatever is filtered. Mounted by /shop, which is its only caller — it owns that
 * page's <h1>.
 *
 * Params are validated here rather than in the page: the filters run on the admin-managed brand
 * catalog, whose category slugs are a different vocabulary from the legacy CATEGORY_MAP the home
 * page validates `?category=` against for its search-results view.
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
      <Container className="pb-14 pt-6">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl">
            Shop
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Filter by category, brand or price to find what your clinic needs.
          </p>
        </div>

        {/* `minmax(0,1fr)` on the grid column, not `1fr`: a track's default `min-width: auto` won't
            shrink below its content, so one long product title would widen the column past its
            share and push the sidebar off. */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <CatalogFilters
            categories={categoryOptions}
            brands={brandOptions}
            category={activeCategory}
            brand={activeBrand}
          />

          {/* Wrapped: AllProductsGrid returns a fragment (toolbar + grid), and a fragment's children
              become separate grid items — the grid would land in the next cell, under the sidebar. */}
          <div>
            <AllProductsGrid
              category={activeCategory}
              brand={activeBrand}
              min={activeMin}
              max={activeMax}
              sort={activeSort}
              mix={mix}
              toolbar={<CatalogToolbar min={activeMin} max={activeMax} sort={activeSort} />}
              gridClassName="grid grid-cols-2 gap-4 md:grid-cols-3"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
