import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth";
import { getBrandForAdmin, getCategories } from "@/lib/content";
import { BrandHeader } from "../BrandHeader";
import { SectionTabs } from "../SectionTabs";
import { ProductsEditor } from "../ProductsEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Products · ${(await getBrandForAdmin(slug))?.name ?? "Brand"}` };
}

/**
 * Products live on their own route: a brand can carry dozens, and inline they buried the eight
 * short sections on the main editor page. The header and section rail are repeated here so this
 * doesn't read as a dead end.
 */
export default async function AdminBrandProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Redirects to /admin if this user doesn't own the brand. The action checks again itself.
  await requireBrandAccess(slug);

  const brand = await getBrandForAdmin(slug);
  if (!brand) notFound();

  const categories = await getCategories();

  return (
    <div>
      <BrandHeader
        brand={brand}
        backHref={`/admin/brands/${brand.slug}`}
        backLabel={`← ${brand.name}`}
      />
      <SectionTabs slug={brand.slug} />
      <div className="mt-8">
        <ProductsEditor brand={brand} categories={categories} />
      </div>
    </div>
  );
}
