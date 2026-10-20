import Link from "next/link";
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
  q,
}: {
  category?: string;
  brand?: string;
  min?: string;
  max?: string;
  sort?: string;
  /** Keyword search from the header search bar. */
  q?: string;
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
  // Capped so a pasted essay can't become the page heading.
  const query = q?.trim().slice(0, 100) ?? "";

  // Dropping the search keeps whatever else is filtered.
  const clearSearchHref = (() => {
    const kept = new URLSearchParams(
      Object.entries({ brand: activeBrand, min, max, sort: activeSort }).filter(
        ([, v]) => v,
      ) as [string, string][],
    );
    const qs = kept.toString();
    return qs ? `/shop?${qs}` : "/shop";
  })();

  // Mix brands together unless the visitor asked for a specific ordering — a brand filter or an
  // explicit sort IS the requested order, so interleaving would fight it.
  const mix = !activeBrand && !activeSort;

  return (
    <section id="catalog" className="scroll-mt-24 bg-surface lg:scroll-mt-36">
      <Container className="pb-14 pt-6">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl">
            {query ? `Results for “${query}”` : "Shop"}
          </h1>
          {query ? (
            <p className="mt-2 max-w-2xl text-muted">
              Matching product names, brands and categories.{" "}
              <Link
                href={clearSearchHref}
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                Clear search
              </Link>
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-muted">
              Filter by category, brand or price to find what your clinic needs.
            </p>
          )}
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
              q={query}
              min={activeMin}
              max={activeMax}
              sort={activeSort}
              mix={mix}
              toolbar={<CatalogToolbar min={activeMin} max={activeMax} sort={activeSort} />}
              emptyState={
                query ? (
                  <div className="rounded-2xl border border-line bg-bg px-6 py-14 text-center">
                    <p className="font-semibold text-fg">No products match “{query}”.</p>
                    <p className="mt-1 text-sm text-muted">
                      Try a different keyword, or ask us — we can source items that aren&apos;t
                      listed yet.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <Link
                        href={clearSearchHref}
                        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg hover:bg-elevated"
                      >
                        Clear search
                      </Link>
                      <Link
                        href="/contact"
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Talk to a sales agent
                      </Link>
                    </div>
                  </div>
                ) : undefined
              }
              gridClassName="grid grid-cols-2 gap-4 md:grid-cols-3"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
