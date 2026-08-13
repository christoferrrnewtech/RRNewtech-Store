import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopControls } from "@/components/shop/ShopControls";
import { ShopBanner } from "@/components/shop/ShopBanner";
import { CategoryCircles } from "@/components/shop/CategoryCircles";
import { DigitalDentistryPromo } from "@/components/home/DigitalDentistryPromo";
import { BrandShowcase } from "@/components/home/BrandShowcase";
import { AboutIntro } from "@/components/home/AboutIntro";
import { HomeCatalog, type HomeView } from "@/components/home/HomeCatalog";
import {
  CATEGORY_MAP,
  brandSlug,
  searchProducts,
  sortProducts,
  type CategorySlug,
  type SortKey,
} from "@/lib/products";
import { getAllProducts } from "@/lib/catalog";
import { getBrandBySlug } from "@/lib/content";
import { SECTIONS, SITE } from "@/lib/constants";

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_MAP));
const VALID_SORTS = new Set<SortKey>([
  "featured",
  "price-asc",
  "price-desc",
  "name-asc",
  "savings-desc",
  "stock-first",
]);

/**
 * Storefront landing page = Shop All. Visiting the site drops the customer straight into the
 * catalog (this is an e-commerce store). Category/brand/search/sort state lives in the URL
 * search params so results stay server-rendered and indexable.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    q?: string;
    brand?: string;
    view?: string;
  }>;
}) {
  const { category, sort, q, brand, view } = await searchParams;

  // Homepage catalog view: grouped brand shelves (default) vs the flat "all products" grid.
  const activeView: HomeView = view === "all" ? "all" : "by-brand";

  const activeCategory =
    category && VALID_CATEGORIES.has(category) ? (category as CategorySlug) : "all";
  const activeSort: SortKey =
    sort && VALID_SORTS.has(sort as SortKey) ? (sort as SortKey) : "featured";
  const query = q?.trim() ?? "";
  const activeBrand = brand ? await getBrandBySlug(brand) : undefined;

  // Apply filters in sequence (AND): category → brand → keyword search.
  let list = await getAllProducts();
  if (activeCategory !== "all") list = list.filter((p) => p.category === activeCategory);
  if (activeBrand) list = list.filter((p) => brandSlug(p.brand) === activeBrand.slug);
  if (query) list = searchProducts(list, query);
  const products = sortProducts(list, activeSort);

  // Merchandising sections only belong on the plain landing view, not on a filtered result set.
  const isUnfiltered = activeCategory === "all" && !query && !activeBrand;

  const heading = query
    ? `Results for “${query}”`
    : activeBrand
      ? activeBrand.name
      : activeCategory === "all"
        ? "All Products"
        : CATEGORY_MAP[activeCategory].name;
  const blurb = query
    ? `${products.length} product${products.length === 1 ? "" : "s"} matching your search.`
    : activeBrand
      ? `Products from ${activeBrand.name}.`
      : activeCategory === "all"
        ? "Everything a clinic or dental professional needs, plus everyday oral-care essentials."
        : CATEGORY_MAP[activeCategory].blurb;

  return (
    <>
      <ShopBanner />

      {isUnfiltered && <AboutIntro />}

      {SECTIONS.categoryCircles && <CategoryCircles activeCategory={activeCategory} />}

      {isUnfiltered && <BrandShowcase />}

      {isUnfiltered && <HomeCatalog view={activeView} />}

      {SECTIONS.digitalDentistry && isUnfiltered && <DigitalDentistryPromo />}

      {/* A filtered/search view always shows its results — the flag only hides the plain catalog. */}
      {(SECTIONS.allProducts || !isUnfiltered) && (
        <section id="catalog" className="scroll-mt-24">
          <Container className="py-12">
            <header className="mb-6">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
                {heading}
              </h2>
              <p className="mt-2 max-w-2xl text-muted">{blurb}</p>
            </header>

            <ShopControls activeSort={activeSort} />

            <p className="mt-5 text-sm text-muted">
              {products.length} product{products.length === 1 ? "" : "s"}
            </p>

            {products.length === 0 ? (
              <p className="mt-10 text-muted">
                {query
                  ? `No products match “${query}”. Try a different keyword.`
                  : "No products in this selection yet — check back soon."}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            )}

            <p className="mt-12 text-xs text-muted-light">
              Prices are in Philippine pesos. Availability and lead times confirmed at order.{" "}
              Questions? Email {SITE.email}.
            </p>
          </Container>
        </section>
      )}
    </>
  );
}
