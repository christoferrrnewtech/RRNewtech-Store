import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { LoadMoreGrid } from "@/components/home/LoadMoreGrid";
import { getBrands, getCategories } from "@/lib/content";

/**
 * The flat "All Products" view body — one marketplace-style grid of every product across all
 * published brands (flattened from `brand.products`, brand order preserved so items group naturally
 * by brand). Each card shows its brand + category. Renders 16 up front with a "Load more" button
 * (see LoadMoreGrid). Renders nothing until at least one brand has products.
 *
 * The section shell, heading and view toggle are owned by the parent (HomeCatalog).
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
    <LoadMoreGrid initialRows={4} stepRows={2}>
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
  );
}
