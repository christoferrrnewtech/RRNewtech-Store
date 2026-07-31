import { Container } from "@/components/ui/Container";
import { AllProductsGrid } from "@/components/home/AllProductsGrid";
import { BrandRailsSection } from "@/components/home/BrandRailsSection";
import { HomeViewToggle } from "@/components/home/HomeViewToggle";

export type HomeView = "by-brand" | "all";

/**
 * The homepage catalog section. Owns the shared header + the By-Brand ⇄ All-Products toggle, then
 * renders one of two bodies based on `view`:
 *   - "by-brand" → grouped brand shelves (BrandRailsSection) — separates high-end from consumables.
 *   - "all"      → the flat marketplace grid (AllProductsGrid) for scan-everything shopping.
 * Only one branch renders per request, so there's no duplicate data fetch.
 */
export function HomeCatalog({ view }: { view: HomeView }) {
  const byBrand = view === "by-brand";
  return (
    <section id="catalog" className="scroll-mt-24 bg-surface">
      <Container className="py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Our Catalog
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
              {byBrand ? "Shop by Brand" : "Shop All Products"}
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              {byBrand
                ? "Browse each brand's line-up on its own shelf — equipment, consumables and laser & whitening, kept separate."
                : "Every product from the brands we carry, in one grid you can scan and sort."}
            </p>
          </div>
          <HomeViewToggle view={view} />
        </div>

        {byBrand ? <BrandRailsSection /> : <AllProductsGrid />}
      </Container>
    </section>
  );
}
