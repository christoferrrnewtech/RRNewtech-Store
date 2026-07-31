import { BrandProductRail } from "@/components/home/BrandProductRail";
import { getBrands } from "@/lib/content";
import { BRAND_GROUPS } from "@/lib/constants";

/** Most products to show in a single brand shelf — "View all →" covers the rest on the brand page. */
const MAX_PER_RAIL = 12;

/**
 * The homepage "By Brand" view: featured brands, grouped under their Equipment / Consumables /
 * Laser & Whitening headers, each rendered as its own product shelf (see BrandProductRail). This is
 * what separates high-end equipment from consumables — every shelf is scoped to one brand.
 *
 * Renders only brands that are featured on home (`featuredOnHome !== false`) and have products.
 * The outer section shell + heading + view toggle are owned by the parent (HomeCatalog).
 */
export async function BrandRailsSection() {
  const brands = (await getBrands().catch(() => [])).filter(
    (b) => b.featuredOnHome !== false && b.products.length > 0,
  );

  if (brands.length === 0) return null;

  // Group brands by their BrandGroup, preserving the storefront brand order within each group.
  const groups = BRAND_GROUPS.map((g) => ({
    ...g,
    brands: brands.filter((b) => b.group === g.key),
  })).filter((g) => g.brands.length > 0);

  return (
    <div className="space-y-14">
      {groups.map((group) => (
        <div key={group.key} className="space-y-8">
          <div className="flex items-center gap-4">
            <h3 className="whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-bold text-fg">
              {group.label}
            </h3>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>

          {group.brands.map((brand) => (
            <BrandProductRail
              key={brand.slug}
              brand={{
                slug: brand.slug,
                name: brand.name,
                logo: brand.logo,
                tagline: brand.tagline,
              }}
              products={brand.products.slice(0, MAX_PER_RAIL)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
