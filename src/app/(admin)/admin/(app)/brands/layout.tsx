import { requireUser } from "@/lib/auth";
import { getAllBrandsForAdmin } from "@/lib/content";
import { BrandRail, type RailBrand } from "./BrandRail";

/**
 * Master–detail shell for the Brands admin: a persistent left rail (add + brand list) and the
 * selected route in the right panel. The rail stays mounted while /admin/brands/[slug] swaps.
 */
export default async function BrandsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const all = await getAllBrandsForAdmin();

  const brands: RailBrand[] = all
    .filter((b) => isAdmin || user.brandSlugs.includes(b.slug))
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      logo: b.logo,
      status: b.status,
      count: b.products.length,
    }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">Brands</h1>
        <p className="mt-1 text-muted">
          {isAdmin
            ? "Pick a brand to edit, reorder how they appear on the storefront, or add a new one. New brands start as drafts."
            : "The brands assigned to you. Edits go live once the brand is published."}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
        {/* Left rail — sticky on desktop with its own scroll. */}
        <div className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-6">
            <BrandRail brands={brands} canCreate={isAdmin} canReorder={isAdmin} />
          </div>
        </div>

        {/* Right panel — the selected route. */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
