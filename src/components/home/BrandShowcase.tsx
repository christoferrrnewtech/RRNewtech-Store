import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getBrands } from "@/lib/content";
import { BrandFilterGrid, type BrandCard } from "@/components/home/BrandFilterGrid";

/** Map published brands → serializable card data for the client grid. Server-only data lives here. */
async function brandCards(): Promise<BrandCard[]> {
  const brands = await getBrands().catch(() => []);
  return brands.map((b) => ({
    slug: b.slug,
    name: b.name,
    logo: b.logo,
    tagline: b.tagline,
    group: b.group ?? "consumables",
    count: b.products.length,
  }));
}

/**
 * "Brands we distribute" — a static wall of logo plates on the home page, each leading to
 * /brands/[slug]. Every brand is visible at once; this replaced an auto-scrolling marquee, which
 * only ever showed part of the list and moved the target while you aimed at it.
 *
 * Logos ship with their own backgrounds, so each sits contained on a white plate rather than being
 * knocked out. The full filterable grid lives on the /brands index page (see `BrandGrid`).
 */
export async function BrandShowcase() {
  const brands = await brandCards();
  if (brands.length === 0) return null;
  return (
    <section aria-labelledby="brands-heading" className="bg-bg py-14 lg:py-16">
      <Container>
        <h2
          id="brands-heading"
          className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl"
        >
          Brands we distribute
        </h2>

        <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/brands/${b.slug}`}
                aria-label={b.name}
                className="relative flex h-28 items-center justify-center rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-md"
              >
                <Image src={b.logo} alt={b.name} fill sizes="300px" className="object-contain p-6" />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** The filterable grid on its own — reused by the /brands index page inside its own Container. */
export async function BrandGrid() {
  return <BrandFilterGrid brands={await brandCards()} />;
}
