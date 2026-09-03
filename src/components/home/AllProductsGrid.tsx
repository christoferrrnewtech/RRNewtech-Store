import Link from "next/link";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { LoadMoreGrid } from "@/components/home/LoadMoreGrid";
import { getBrands, getCategories } from "@/lib/content";
import type { CatalogSort } from "@/components/home/HomeCatalog";

/**
 * One product per brand in turn, then each brand's next — so the opening rows show many brands
 * instead of everything the first brand sells. Group order follows the curated brand order, which
 * makes the result deterministic: it doesn't reshuffle when a filter changes.
 */
function interleaveByBrand<T extends { brandSlug: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const g = groups.get(it.brandSlug);
    if (g) g.push(it);
    else groups.set(it.brandSlug, [it]);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

/**
 * The flat product grid — every product across all published brands, narrowed by the optional
 * category/brand/price filters and reordered by `sort`. Each card shows its brand + category.
 * Renders 16 up front with a "Load more" button (see LoadMoreGrid).
 *
 * The section shell, heading and filter row are owned by the parent (HomeCatalog), which also
 * validates the filter values before they get here.
 */
export async function AllProductsGrid({
  category,
  brand,
  min,
  max,
  sort,
  mix,
}: {
  category?: string;
  brand?: string;
  min?: number;
  max?: number;
  sort?: CatalogSort;
  /** Round-robin the brands instead of listing them one after another. */
  mix?: boolean;
}) {
  const [brands, categories] = await Promise.all([
    getBrands().catch(() => []),
    getCategories().catch(() => []),
  ]);
  let items = brands.flatMap((b) =>
    b.products.map((product) => ({
      product,
      brandName: b.name,
      brandSlug: b.slug,
      brandLogo: b.logo,
    })),
  );

  // Nothing published yet — the parent's empty state would be misleading, so say nothing at all.
  if (items.length === 0) return null;

  if (mix) items = interleaveByBrand(items);

  if (category) items = items.filter((it) => it.product.category === category);
  if (brand) items = items.filter((it) => it.brandSlug === brand);

  // Bounds are inclusive — that's what people expect from numbers they typed themselves.
  if (min !== undefined || max !== undefined) {
    items = items.filter((it) => {
      // Price-on-request products advertise no price, so they can't honestly be range-matched.
      if (it.product.contactSales) return false;
      const p = it.product.price;
      return (min === undefined || p >= min) && (max === undefined || p <= max);
    });
  }

  if (sort === "quote-first") {
    // Stable partition: each group keeps its brand order.
    items = [
      ...items.filter((it) => it.product.contactSales),
      ...items.filter((it) => !it.product.contactSales),
    ];
  } else if (sort === "price-asc" || sort === "price-desc") {
    const dir = sort === "price-asc" ? 1 : -1;
    items = [...items].sort((a, b) => {
      // Quote-on-request items have no advertised price — rank them last either way rather than
      // ordering them by a number the storefront deliberately hides.
      const qa = Number(Boolean(a.product.contactSales));
      const qb = Number(Boolean(b.product.contactSales));
      if (qa !== qb) return qa - qb;
      return (a.product.price - b.product.price) * dir;
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-bg px-6 py-14 text-center">
        <p className="font-semibold text-fg">No products match these filters.</p>
        <p className="mt-1 text-sm text-muted">
          Try widening one of them, or ask us — we can source items that aren&apos;t listed yet.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            scroll={false}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-fg hover:bg-elevated"
          >
            Clear filters
          </Link>
          <Link
            href="/contact"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Talk to a sales agent
          </Link>
        </div>
      </div>
    );
  }

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
    <>
      <p className="mb-4 text-sm text-muted">
        {items.length} product{items.length === 1 ? "" : "s"}
      </p>
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
    </>
  );
}
