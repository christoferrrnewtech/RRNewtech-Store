import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductJsonLd } from "@/components/analytics/ProductJsonLd";
import { ProductDescription } from "@/components/product/ProductDescription";
import { CATEGORY_MAP, productImageUrl } from "@/lib/products";
import { catalogCartItem } from "@/lib/cart-item";
import { getAllProducts, getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { productBrandLogo } from "@/lib/content";
import { discountPercent, formatPHP } from "@/lib/format";

// Pre-render every product page at build time (ISR-ready, fully indexable HTML). Falls back to
// on-demand rendering if Firestore isn't reachable at build (e.g. before credentials are set).
export async function generateStaticParams() {
  try {
    return (await getAllProducts()).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const title = `${product.name} — ${product.brand}`;
  return {
    title,
    description: product.summary,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title,
      description: product.summary,
      images: [{ url: productImageUrl(product, 1200), width: 1200, height: 1200 }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = CATEGORY_MAP[product.category];
  const off = discountPercent(product.price, product.compareAtPrice);
  const related = await getRelatedProducts(product, 4);
  // Products with no photo yet show the brand wordmark on a white plate instead.
  const logo = await productBrandLogo(product);

  return (
    <>
      <ProductJsonLd product={product} />
      <Container className="py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span className="mx-2 text-line-strong">/</span>
          <Link href={`/categories/${category.slug}`} className="hover:text-brand-700">
            {category.name}
          </Link>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div
            className={[
              "relative aspect-square overflow-hidden rounded-2xl border border-line",
              logo ? "bg-white" : "bg-surface",
            ].join(" ")}
          >
            {logo ? (
              <Image
                src={logo}
                alt={product.brand}
                fill
                sizes="(max-width: 1024px) 100vw, 500px"
                className="object-contain p-12"
                priority
              />
            ) : (
              <Image
                src={productImageUrl(product, 900)}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 500px"
                className="object-cover"
                priority
              />
            )}
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              {off && <Badge tone="sale">-{off}% OFF</Badge>}
              {!product.inStock && <Badge tone="muted">Out of stock</Badge>}
            </div>
          </div>

          {/* Details */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-light">
              {product.brand} · {category.name}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-fg sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-fg">{formatPHP(product.price)}</span>
              {product.compareAtPrice && (
                <span className="text-lg text-muted-light line-through">
                  {formatPHP(product.compareAtPrice)}
                </span>
              )}
              {off && <Badge tone="sale">Save {off}%</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              per {product.unit} · SKU {product.sku}
            </p>

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

            <p className="mt-5 text-base leading-relaxed text-muted">{product.summary}</p>

            <div className="mt-6">
              <ProductPurchase
                inStock={product.inStock}
                item={catalogCartItem(product, logo ?? productImageUrl(product, 300))}
              />
            </div>

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
          </div>
        </div>

        {/* Description */}
        <section className="mt-14">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
            Product details
          </h2>
          <ProductDescription description={product.description} name={product.name} />
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              You might also need
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
