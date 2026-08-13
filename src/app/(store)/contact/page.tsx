import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "./ContactForm";
import { SITE } from "@/lib/constants";
import { getBrandBySlug } from "@/lib/content";
import { brandProductHref, brandProductSlugify } from "@/lib/products";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with R&R Newtech Dental Corporation for orders, bulk pricing, and product inquiries. PH-based support, Monday to Saturday.",
  alternates: { canonical: "/contact" },
};

/**
 * Resolve `?product=&brand=` into the real product.
 *
 * Read from Firestore rather than trusted, so a hand-edited link can't put an invented product name
 * on the page. Unknown slugs simply render the plain form. The action repeats this lookup before
 * storing — this copy is only for display.
 */
async function productFromParams(brandSlug?: string, productSlug?: string) {
  if (!brandSlug || !productSlug) return undefined;

  const brand = await getBrandBySlug(brandSlug);
  const product = brand?.products.find(
    (p) => (p.slug ?? brandProductSlugify(p.name, p.id)) === productSlug || p.id === productSlug,
  );
  if (!brand || !product) return undefined;

  return {
    brandSlug: brand.slug,
    productSlug,
    name: product.name,
    href: brandProductHref(brand.slug, product),
    image: product.image || brand.logo,
    brandName: brand.name,
  };
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; brand?: string }>;
}) {
  const { product: productSlug, brand: brandSlug } = await searchParams;
  const product = await productFromParams(brandSlug, productSlug);

  return (
    <Container className="py-12">
      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
            {product ? "Ask about this product" : "Contact us"}
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            {product
              ? "Tell us a little about what your clinic needs and our sales team will come back with pricing and availability."
              : "Questions about a product, an order, or bulk pricing for your clinic? Send us a message and our team will get back to you."}
          </p>

          {product && (
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-contain p-1.5"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Asking about
                </p>
                <p className="mt-0.5 font-semibold text-fg">{product.name}</p>
                <p className="mt-0.5 text-sm text-muted">{product.brandName}</p>
              </div>
            </div>
          )}

          <div className="mt-8">
            <Suspense fallback={<p className="text-muted">Loading form…</p>}>
              <ContactForm product={product} />
            </Suspense>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-base font-bold text-fg">Reach us directly</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-light">Email</dt>
              <dd>
                <a href={`mailto:${SITE.email}`} className="font-medium text-brand-700 hover:text-brand-800">
                  {SITE.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-light">Phone</dt>
              {SITE.phones.map((p) => (
                <dd key={p.tel} className="font-medium text-fg">
                  <a href={`tel:${p.tel}`} className="hover:text-brand-700">
                    {p.label ? `${p.label}: ${p.value}` : p.value}
                  </a>
                </dd>
              ))}
            </div>
            <div>
              <dt className="text-muted-light">Support hours</dt>
              <dd className="font-medium text-fg">{SITE.supportLine}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Container>
  );
}
