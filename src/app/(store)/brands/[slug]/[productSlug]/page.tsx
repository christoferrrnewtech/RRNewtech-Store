import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { BrandProductGallery, type GalleryImg } from "@/components/shop/BrandProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { getBrandBySlug, getBrands, type Brand, type BrandProduct } from "@/lib/content";
import { brandProductHref } from "@/lib/products";
import { discountPercent, formatPHP } from "@/lib/format";
import { SITE } from "@/lib/constants";

/** Find a product on a brand by its slug, falling back to its id (legacy products have no slug). */
function findProduct(brand: Brand, productSlug: string): BrandProduct | undefined {
  return (
    brand.products.find((p) => p.slug === productSlug) ??
    brand.products.find((p) => p.id === productSlug)
  );
}

// Pre-render every published brand product at build time (indexable HTML). Falls back to on-demand
// rendering if Firestore isn't reachable at build.
export async function generateStaticParams() {
  try {
    return (await getBrands()).flatMap((b) =>
      b.products.map((p) => ({ slug: b.slug, productSlug: p.slug ?? p.id })),
    );
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const brand = await getBrandBySlug(slug);
  const product = brand && findProduct(brand, productSlug);
  if (!brand || !product) return { title: "Product not found" };

  const title = `${product.name} — ${brand.name}`;
  const description = product.summary || `${product.name} from ${brand.name}.`;
  const image = product.image || brand.logo;
  return {
    title,
    description,
    alternates: { canonical: brandProductHref(brand.slug, product) },
    openGraph: {
      type: "website",
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

/**
 * Brand-product detail page. Mirrors the catalog PDP but for a brand-owned product. Draft brands
 * 404 (getBrandBySlug returns undefined); an unknown product slug/id 404s too.
 */
export default async function BrandProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const product = findProduct(brand, productSlug);
  if (!product) notFound();

  const usingLogo = !product.image;
  const off = product.contactSales ? null : discountPercent(product.price, product.compareAtPrice);

  // Main image first (brand logo fallback rendered contained-on-white), then any extra photos.
  const images: GalleryImg[] = [
    { src: product.image || brand.logo, contain: usingLogo },
    ...(product.gallery ?? []).map((g) => ({ src: g.src, contain: false })),
  ];

  const siblings = brand.products.filter((p) => p.id !== product.id).slice(0, 4);

  // JSON-LD: omit the Offer block for "contact sales" products (no public price).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary || undefined,
    image: product.image || brand.logo || undefined,
    brand: { "@type": "Brand", name: brand.name },
    ...(product.contactSales
      ? {}
      : {
          offers: {
            "@type": "Offer",
            priceCurrency: "PHP",
            price: product.price,
            availability: product.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: `${SITE.url}${brandProductHref(brand.slug, product)}`,
          },
        }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container className="py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span className="mx-2 text-line-strong">/</span>
          <Link href="/brands" className="hover:text-brand-700">Brands</Link>
          <span className="mx-2 text-line-strong">/</span>
          <Link href={`/brands/${brand.slug}`} className="hover:text-brand-700">{brand.name}</Link>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div className="relative">
            <BrandProductGallery images={images} alt={product.name} />
            <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
              {off && <Badge tone="sale">-{off}% OFF</Badge>}
              {!product.contactSales && !product.inStock && <Badge tone="muted">Out of stock</Badge>}
            </div>
          </div>

          {/* Details */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-light">
              {brand.name}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-fg sm:text-3xl">
              {product.name}
            </h1>

            {product.contactSales ? (
              <>
                <p className="mt-4 text-lg font-semibold text-fg">Contact a sales agent for pricing</p>
                {product.summary && (
                  <p className="mt-3 text-base leading-relaxed text-muted">{product.summary}</p>
                )}
                <div className="mt-6">
                  <LinkButton href="/contact" size="lg">Contact a sales agent</LinkButton>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-fg">{formatPHP(product.price)}</span>
                  {product.compareAtPrice && (
                    <span className="text-lg text-muted-light line-through">
                      {formatPHP(product.compareAtPrice)}
                    </span>
                  )}
                  {off && <Badge tone="sale">Save {off}%</Badge>}
                </div>

                <div className="mt-4">
                  {product.inStock ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <span className="h-2 w-2 rounded-full bg-success" /> In stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
                      <span className="h-2 w-2 rounded-full bg-muted-light" /> Currently unavailable
                    </span>
                  )}
                </div>

                {product.summary && (
                  <p className="mt-5 text-base leading-relaxed text-muted">{product.summary}</p>
                )}

                <div className="mt-6">
                  <ProductPurchase
                    inStock={product.inStock}
                    item={{
                      slug: product.slug ?? product.id,
                      name: product.name,
                      price: product.price,
                      unit: "",
                      sku: product.id,
                      category: brand.name,
                      image: product.image || brand.logo,
                    }}
                  />
                </div>
              </>
            )}

            {product.highlights && product.highlights.length > 0 && (
              <ul className="mt-8 grid gap-2 border-t border-line pt-6">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-fg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true">
                      <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && product.description.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              Product details
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
              {product.description.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* More from this brand */}
        {siblings.length > 0 && (
          <section className="mt-16">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              More from {brand.name}
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {siblings.map((p) => (
                <BrandProductCard
                  key={p.id}
                  product={p}
                  brandName={brand.name}
                  brandSlug={brand.slug}
                  brandLogo={brand.logo}
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-12">
          <Link href={`/brands/${brand.slug}`} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            ← Back to {brand.name}
          </Link>
        </div>
      </Container>
    </>
  );
}
