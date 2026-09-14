import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AllProductsGrid } from "@/components/home/AllProductsGrid";
import { CatalogFilters } from "@/components/home/CatalogFilters";
import { CatalogToolbar } from "@/components/home/CatalogToolbar";
import type { CatalogSort as CatalogSortKey } from "@/components/home/HomeCatalog";
import { getBrands, getCategories, getCategoriesWithProducts } from "@/lib/content";
import { SITE } from "@/lib/constants";

const SORTS = new Set<string>(["price-asc", "price-desc", "quote-first"]);

/** A price bound is only honoured when it parses to a non-negative whole number. */
function bound(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Pre-render a page per admin-managed category; new ones render on demand (dynamicParams default).
export async function generateStaticParams() {
  return (await getCategories().catch(() => [])).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} — Dental Products in the Philippines`,
    description: cat.blurb,
    alternates: { canonical: `/categories/${slug}` },
  };
}

/**
 * Category listing — the single destination for a category.
 *
 * This is the catalog scoped to one category, not a separate browsing system: it renders the same
 * sidebar, price/sort toolbar and product grid as /shop, plus the subcategory chips that only exist
 * at this level. `/shop?category=` used to be a second URL for the same thing and now redirects
 * here, so a category has one address — which is also the one carrying the title, description and
 * canonical that make it worth indexing.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sub?: string;
    brand?: string;
    min?: string;
    max?: string;
    sort?: string;
  }>;
}) {
  const { slug } = await params;
  const { sub, brand, min, max, sort } = await searchParams;

  const [allCategories, sidebarCategories, brands] = await Promise.all([
    getCategories(),
    getCategoriesWithProducts().catch(() => []),
    getBrands().catch(() => []),
  ]);

  const cat = allCategories.find((c) => c.slug === slug);
  if (!cat) notFound();

  // Subcategories that actually have something in them. Derived here rather than from
  // getCategoriesWithProducts(), which drops an unstocked CATEGORY entirely — that would 404 a real
  // but empty category instead of showing it with its "no products here yet" state.
  const stocked = new Set(
    brands
      .flatMap((b) => b.products)
      .filter((p) => p.category === slug && p.subcategory)
      .map((p) => p.subcategory),
  );
  const subcategories = cat.subcategories.filter((s) => stocked.has(s.slug));

  // An unrecognised param is treated as unset, so a hand-edited URL degrades to "no filter"
  // rather than an empty grid.
  const activeSub = subcategories.some((s) => s.slug === sub) ? sub : undefined;
  const subName = new Map(cat.subcategories.map((s) => [s.slug, s.name]));

  const brandOptions = brands
    .filter((b) => b.products.length > 0)
    .map((b) => ({ slug: b.slug, name: b.name }));
  const activeBrand = brandOptions.some((b) => b.slug === brand) ? brand : undefined;
  const activeMin = bound(min);
  const activeMax = bound(max);
  const activeSort = sort && SORTS.has(sort) ? (sort as CatalogSortKey) : undefined;

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="mx-2 text-line-strong">/</span>
        <span className="text-fg">{cat.name}</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Category</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
          {cat.name}
        </h1>
        {cat.blurb && <p className="mt-2 text-muted">{cat.blurb}</p>}
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <CatalogFilters
          categories={sidebarCategories.map((c) => ({ slug: c.slug, name: c.name }))}
          brands={brandOptions}
          category={slug}
          brand={activeBrand}
        />

        {/* Wrapped: AllProductsGrid returns a fragment, and a fragment's children would each become
            their own grid item — the product grid would land in the next cell, under the sidebar. */}
        <div>
          {subcategories.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              <Chip href={`/categories/${slug}`} active={!activeSub}>
                All
              </Chip>
              {subcategories.map((s) => (
                <Chip
                  key={s.slug}
                  href={`/categories/${slug}?sub=${s.slug}`}
                  active={activeSub === s.slug}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          )}

          <AllProductsGrid
            category={slug}
            sub={activeSub}
            brand={activeBrand}
            min={activeMin}
            max={activeMax}
            sort={activeSort}
            toolbar={<CatalogToolbar min={activeMin} max={activeMax} sort={activeSort} />}
            gridClassName="grid grid-cols-2 gap-4 md:grid-cols-3"
            emptyState={
              <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
                  No products here yet
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  We&rsquo;re still adding products
                  {activeSub ? ` under ${subName.get(activeSub)}` : ""}. Browse our{" "}
                  <Link href="/brands" className="font-semibold text-brand-700 hover:text-brand-800">
                    brands
                  </Link>{" "}
                  in the meantime.
                </p>
              </div>
            }
          />
        </div>
      </div>

      <p className="mt-12 text-xs text-muted-light">
        Prices are in Philippine pesos. Availability and lead times confirmed at order. Questions?
        Email {SITE.email}.
      </p>
    </Container>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-lg border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-fg hover:border-brand-600",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
