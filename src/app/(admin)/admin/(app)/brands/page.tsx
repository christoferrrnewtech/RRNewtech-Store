import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getAllBrandsForAdmin } from "@/lib/content";
import { BrandsIndex } from "./BrandsIndex";
import type { RailBrand } from "./BrandRail";

export const metadata: Metadata = { title: "Brands" };

/**
 * Brands manage page: add a brand, reorder the storefront order, and see every brand at a glance.
 * The sidebar owns quick-navigation into each brand's editor.
 */
export default async function AdminBrandsIndex() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const brands: RailBrand[] = (await getAllBrandsForAdmin())
    .filter((b) => isAdmin || user.brandSlugs.includes(b.slug))
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      logo: b.logo,
      status: b.status,
      count: b.products.length,
    }));

  return <BrandsIndex brands={brands} canManage={isAdmin} />;
}
