import { Container } from "@/components/ui/Container";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { LoadMoreGrid } from "@/components/home/LoadMoreGrid";
import { getBrands, getCategories } from "@/lib/content";

/**
 * "Shop All Products" — one flat, marketplace-style grid of every product across all published
 * brands (flattened from `brand.products`, brand order preserved so items group naturally by brand).
 * Each card shows its brand name. Renders 16 up front with a "Load more" button (see LoadMoreGrid).
 * Renders nothing until at least one brand has products.
 */
export async function AllProductsGrid() {
  const [brands, categories] = await Promise.all([
    getBrands().catch(() => []),
    getCategories().catch(() => []),
  ]);
  const items = brands.flatMap((b) =>
    b.products.map((product) => ({
      product,
      brandName: b.name,
      brandSlug: b.slug,
      brandLogo: b.logo,
    })),
  );

  if (items.length === 0) return null;

  // Resolve "Category · Subcategory" labels for the card eyebrow from the admin-managed taxonomy.
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const subName = new Map(
    categories.flatMap((c) => c.subcategories.map((s) => [`${c.slug}/${s.slug}`, s.name])),
  );
  const labelFor = (category?: string, subcategory?: string): string | undefined => {
    if (!category) return undefined;
    const cn = catName.get(category);
    if (!cn) return undefined;
    const sn = subcategory ? subName.get(`${category}/${subcategory}`) : undefined;
    return sn ? `${cn} · ${sn}` : cn;
  };

  return (
    <section aria-labelledby="all-products-heading" className="bg-surface">
      <Container className="py-14">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Our Catalog</p>
          <h2
            id="all-products-heading"
            className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl"
          >
            Shop All Products
          </h2>
          <p className="mt-2 text-muted">
            {items.length} product{items.length === 1 ? "" : "s"} from the brands we carry.
          </p>
        </div>

        <LoadMoreGrid initial={16} step={16}>
          {items.map((it) => (
            <BrandProductCard
              key={`${it.brandSlug}-${it.product.id}`}
              product={it.product}
              brandName={it.brandName}
              brandSlug={it.brandSlug}
              brandLogo={it.brandLogo}
              categoryLabel={labelFor(it.product.category, it.product.subcategory)}
              showBrand
            />
          ))}
        </LoadMoreGrid>
      </Container>
    </section>
  );
}
