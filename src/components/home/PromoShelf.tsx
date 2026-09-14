import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { RowCappedGrid } from "@/components/home/RowGrid";
import { getBrands } from "@/lib/content";
import { discountPercent } from "@/lib/format";

/** Two rows, whatever the breakpoint — 8 cards on desktop, 6 on tablet, 4 on a phone. */
const ROWS = 2;

/**
 * "On promo now" — the products currently marked down.
 *
 * A product qualifies only if it advertises a real price AND a genuine markdown. `discountPercent`
 * already returns null unless `compareAtPrice` is above `price`, so it is the whole test: a stale
 * compare-at that's been overtaken by a price rise can't sneak in as a fake saving. Quote-on-request
 * items are excluded outright — they publish no price to discount.
 *
 * Deepest discount first, so the strongest offer leads rather than whichever brand happens to sort
 * first. Renders nothing at all when nothing is on promo, rather than an empty heading.
 */
export async function PromoShelf() {
  const brands = await getBrands().catch(() => []);

  const items = brands
    .flatMap((b) =>
      b.products.map((product) => ({
        product,
        brandName: b.name,
        brandSlug: b.slug,
        brandLogo: b.logo,
        off: product.contactSales
          ? null
          : discountPercent(product.price, product.compareAtPrice),
      })),
    )
    .filter((it) => it.product.price > 0 && it.off !== null)
    .sort((a, b) => b.off! - a.off!);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="promo-heading" className="bg-surface py-14 lg:py-16">
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2
            id="promo-heading"
            className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl"
          >
            On promo now
          </h2>
          <Link href="/shop" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            View all &rarr;
          </Link>
        </div>

        <RowCappedGrid rows={ROWS}>
          {items.map((it) => (
            <BrandProductCard
              key={`${it.brandSlug}-${it.product.id}`}
              product={it.product}
              brandName={it.brandName}
              brandSlug={it.brandSlug}
              brandLogo={it.brandLogo}
              showBrand
            />
          ))}
        </RowCappedGrid>
      </Container>
    </section>
  );
}
