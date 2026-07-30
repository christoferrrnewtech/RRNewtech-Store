import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";
import { getProductsByCategory } from "@/lib/catalog";

/**
 * Merchandising section that promotes the Digital Dentistry category: a brand-blue feature
 * panel beside a rail of product cards (reusing ProductCard for a consistent look). Renders
 * nothing if the category has no products yet.
 */
export async function DigitalDentistryPromo() {
  const products = (await getProductsByCategory("digital-dentistry")).slice(0, 3);
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="digital-dentistry-heading" className="bg-surface">
      <Container className="py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Featured
            </p>
            <h2
              id="digital-dentistry-heading"
              className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl"
            >
              Digital Dentistry
            </h2>
          </div>
          <Link
            href="/categories/digital-dentistry"
            className="whitespace-nowrap text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View all →
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {/* Feature panel */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-8 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                Digital Dentistry
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
                Upgrade your clinic to digital dentistry.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Improve efficiency, reduce errors, and give patients a better experience with
                intraoral and facial scanning.
              </p>
            </div>
            <LinkButton
              href="/categories/digital-dentistry"
              variant="inverse"
              className="relative mt-8 w-fit"
            >
              Learn more
            </LinkButton>
          </div>

          {/* Product rail */}
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
