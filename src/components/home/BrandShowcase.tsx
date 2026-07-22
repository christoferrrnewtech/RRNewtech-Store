import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getBrands } from "@/lib/content";
import { getProductsByBrand } from "@/lib/products";

/**
 * "Shop by Brand" — a grid of logo cards, one per published brand, each leading to its own
 * /brands/[slug] page. Shown on the unfiltered home page. Logos ship with their own backgrounds,
 * so each sits contained on a white plate rather than cropped to fill the card.
 */
export function BrandShowcase() {
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

        <BrandGrid />
      </Container>
    </section>
  );
}

/** The card grid on its own — reused by the /brands index page inside its own Container. */
export function BrandGrid() {
  const brands = getBrands();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {brands.map((b) => {
        const count = getProductsByBrand(b.slug).length;
        return (
          <Link
            key={b.slug}
            href={`/brands/${b.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg"
          >
            <div className="relative aspect-[16/9] border-b border-line bg-white p-8">
              <Image
                src={b.logo}
                alt={b.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                className="object-contain p-8 transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm leading-relaxed text-muted">{b.tagline}</p>
              <div className="mt-4 flex-1" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-brand-700 group-hover:text-brand-800">
                  Shop {b.name} →
                </span>
                <span className="text-xs text-muted-light">
                  {count} product{count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
