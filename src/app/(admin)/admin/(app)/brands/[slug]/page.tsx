import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth";
import { getBrandForAdmin } from "@/lib/content";
import { getProductsByBrand, getAllProducts } from "@/lib/products";
import { BrandEditor } from "./BrandEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: getBrandForAdmin(slug)?.name ?? "Brand" };
}

export default async function AdminBrandEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Redirects to /admin if this user doesn't own the brand. The actions check again themselves.
  const user = await requireBrandAccess(slug);

  const brand = getBrandForAdmin(slug);
  if (!brand) notFound();

  // Offer this brand's own catalog first, then everything else, so featuring is quick but
  // cross-brand bundles are still possible.
  const own = getProductsByBrand(slug);
  const ownSlugs = new Set(own.map((p) => p.slug));
  const others = getAllProducts().filter((p) => !ownSlugs.has(p.slug));

  return (
    <div className="max-w-3xl">
      <Link href="/admin/brands" className="text-sm text-muted hover:text-brand-700">
        ← All brands
      </Link>

      <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        {brand.name}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Sections appear here in the same order they appear on{" "}
        <Link
          href={`/brands/${brand.slug}`}
          target="_blank"
          className="font-medium text-brand-700 hover:underline"
        >
          /brands/{brand.slug} ↗
        </Link>
        . Each section saves on its own.
      </p>

      <BrandEditor
        brand={brand}
        ownProducts={own.map((p) => ({ slug: p.slug, name: p.name }))}
        otherProducts={others.map((p) => ({ slug: p.slug, name: `${p.brand} — ${p.name}` }))}
        canDelete={user.role === "admin"}
      />
    </div>
  );
}
