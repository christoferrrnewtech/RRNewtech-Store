import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { LoadMoreGrid } from "@/components/home/LoadMoreGrid";
import { getBrands, getCategories } from "@/lib/content";
import { SITE } from "@/lib/constants";

// Pre-render a page per admin-managed category; new ones render on demand (dynamicParams default).
export async function generateStaticParams() {
  return (await getCategories().catch(() => [])).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} — Dental Products in the Philippines`,
    description: cat.blurb,
    alternates: { canonical: `/categories/${slug}` },
  };
}

/**
 * Category listing — every published brand product tagged with this category, with clickable
 * subcategory filter chips (?sub=). Empty until products are tagged in the admin (brand → Products).
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { slug } = await params;
  const { sub } = await searchParams;

  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) notFound();

  const activeSub = cat.subcategories.some((s) => s.slug === sub) ? sub : undefined;
  const subName = new Map(cat.subcategories.map((s) => [s.slug, s.name]));

  const brands = await getBrands().catch(() => []);
  const items = brands.flatMap((b) =>
    b.products
      .filter((p) => p.category === slug && (!activeSub || p.subcategory === activeSub))
      .map((product) => ({ product, brandName: b.name, brandSlug: b.slug, brandLogo: b.logo })),
  );

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="mx-2 text-line-strong">/</span>
        <span className="text-fg">{cat.name}</span>
      </nav>

      <header className="mb-6 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Category</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
          {cat.name}
        </h1>
        {cat.blurb && <p className="mt-2 text-muted">{cat.blurb}</p>}
      </header>

      {cat.subcategories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip href={`/categories/${slug}`} active={!activeSub}>
            All
          </Chip>
          {cat.subcategories.map((s) => (
            <Chip
              key={s.slug}
              href={`/categories/${slug}?sub=${s.slug}`}
              active={activeSub === s.slug}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            No products here yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            We&rsquo;re still adding products{activeSub ? ` under ${subName.get(activeSub)}` : ""}.
            Browse our{" "}
            <Link href="/brands" className="font-semibold text-brand-700 hover:text-brand-800">
              brands
            </Link>{" "}
            in the meantime.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {items.length} product{items.length === 1 ? "" : "s"}
          </p>
          <LoadMoreGrid initial={16} step={16}>
            {items.map((it) => (
              <BrandProductCard
                key={`${it.brandSlug}-${it.product.id}`}
                product={it.product}
                brandName={it.brandName}
                brandSlug={it.brandSlug}
                brandLogo={it.brandLogo}
                categoryLabel={it.product.subcategory ? subName.get(it.product.subcategory) : undefined}
                showBrand
              />
            ))}
          </LoadMoreGrid>
        </>
      )}

      <p className="mt-12 text-xs text-muted-light">
        Prices are in Philippine pesos. Availability and lead times confirmed at order. Questions?
        Email {SITE.email}.
      </p>
    </Container>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-fg hover:border-brand-600",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
