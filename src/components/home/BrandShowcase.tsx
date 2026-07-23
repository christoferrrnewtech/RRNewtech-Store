import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getBrands } from "@/lib/content";
import { getAllProducts } from "@/lib/catalog";
import { brandSlug } from "@/lib/products";
import { BrandFilterGrid, type BrandCard } from "@/components/home/BrandFilterGrid";

/** Map published brands → serializable card data for the client grid. Server-only data lives here. */
async function brandCards(): Promise<BrandCard[]> {
  const [brands, products] = await Promise.all([
    getBrands().catch(() => []),
    getAllProducts().catch(() => []),
  ]);
  // One product read, counted per brand in memory (avoids a query per brand).
  const counts = new Map<string, number>();
  for (const p of products) {
    const slug = brandSlug(p.brand);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return brands.map((b) => ({
    slug: b.slug,
    name: b.name,
    logo: b.logo,
    tagline: b.tagline,
    group: b.group ?? "consumables",
    count: counts.get(b.slug) ?? 0,
  }));
}

/**
 * "Shop by Brand" — header + the filterable bento tile grid, shown on the unfiltered home page.
 * Each tile leads to /brands/[slug]. Logos ship with their own backgrounds, so they sit contained
 * on a light plate rather than cropped to fill the card.
 */
export async function BrandShowcase() {
  const brands = await brandCards();
  return (
    <section aria-labelledby="brands-heading" className="bg-bg">
      <Container className="py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Our Brands
            </p>
            <h2
              id="brands-heading"
              className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl"
            >
              Shop by Brand
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              The names our clinics ask for — scanning, printing, whitening and lasers, plus the
              consumables that keep the chair running.
            </p>
          </div>
          <Link
            href="/brands"
            className="whitespace-nowrap text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View all →
          </Link>
        </div>

        <BrandFilterGrid brands={brands} />
      </Container>
    </section>
  );
}

/** The filterable grid on its own — reused by the /brands index page inside its own Container. */
export async function BrandGrid() {
  return <BrandFilterGrid brands={await brandCards()} />;
}
