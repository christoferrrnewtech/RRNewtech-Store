import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth";
import { getBrandForAdmin, productBrandLogo } from "@/lib/content";
import { getProductsByBrand, getAllProducts } from "@/lib/catalog";
import { productImageUrl } from "@/lib/products";
import { formatPHP } from "@/lib/format";
import { BrandEditor } from "./BrandEditor";
import { BRAND_EDITOR_SECTIONS, type ProductOption } from "./sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getBrandForAdmin(slug))?.name ?? "Brand" };
}

function toOption(p: {
  slug: string;
  name: string;
  brand: string;
  price: number;
}): Omit<ProductOption, "image"> {
  return { slug: p.slug, name: p.name, price: formatPHP(p.price) };
}

export default async function AdminBrandEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Redirects to /admin if this user doesn't own the brand. The actions check again themselves.
  const user = await requireBrandAccess(slug);

  const brand = await getBrandForAdmin(slug);
  if (!brand) notFound();

  // Offer this brand's own catalog first, then everything else, so featuring is quick but
  // cross-brand bundles are still possible. Each option carries a thumbnail + price for the picker.
  const [own, all] = await Promise.all([getProductsByBrand(slug), getAllProducts()]);
  const ownSlugs = new Set(own.map((p) => p.slug));
  const others = all.filter((p) => !ownSlugs.has(p.slug));

  const image = async (p: (typeof own)[number]) =>
    (await productBrandLogo(p)) ?? productImageUrl(p, 200);
  const ownProducts: ProductOption[] = await Promise.all(
    own.map(async (p) => ({ ...toOption(p), image: await image(p) })),
  );
  const otherProducts: ProductOption[] = await Promise.all(
    others.map(async (p) => ({
      ...toOption(p),
      name: `${p.brand} — ${p.name}`,
      image: await image(p),
    })),
  );

  return (
    <div>
      <Link href="/admin/brands" className="text-sm text-muted hover:text-brand-700">
        ← All brands
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
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
            ownProducts={ownProducts}
            otherProducts={otherProducts}
            canDelete={user.role === "admin"}
          />
        </div>

        {/* Sticky jump rail — fills the space and makes every section one click away. */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl border border-line bg-surface p-4">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Jump to</p>
            <nav className="mt-2 flex flex-col">
              {BRAND_EDITOR_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-elevated hover:text-brand-700"
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <Link
              href={`/brands/${brand.slug}`}
              target="_blank"
              className="mt-3 block border-t border-line px-2 pt-3 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View live page ↗
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
