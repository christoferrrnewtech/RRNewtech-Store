import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "./ContactForm";
import { SITE } from "@/lib/constants";
import { getBrandBySlug } from "@/lib/content";
import { brandProductHref, brandProductSlugify } from "@/lib/products";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerName } from "@/lib/customers";
import { formatPhone } from "@/lib/customer-fields";

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
  // The session read costs this page nothing in prerendering — `searchParams` already makes it
  // dynamic. A guest simply gets an empty form, as before.
  const [product, customer] = await Promise.all([
    productFromParams(brandSlug, productSlug),
    getCurrentCustomer().catch(() => null),
  ]);

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
              <ContactForm
                product={product}
                customer={
                  customer
                    ? {
                        name: customerName(customer),
                        email: customer.email,
                        // Displayed the way /account shows it (0917-123-4567) rather than the
                        // canonical 11 digits it is stored as. An inquiry's phone is free text,
                        // so either shape stores fine — this is the one the customer recognises.
                        phone: formatPhone(customer.phone),
                      }
                    : undefined
                }
              />
            </Suspense>
          </div>
        </div>

        {/* One card per way of reaching us, rather than one card of stacked rows. Each is a single
            scannable claim, so a visitor who wants to phone rather than type finds it without
            reading the block. */}
        <aside className="h-fit space-y-4">
          <InfoCard title="Sales line" icon={<PhoneIcon />}>
            {SITE.phones.map((p) => (
              <a
                key={p.tel}
                href={`tel:${p.tel}`}
                className="block text-muted hover:text-brand-700"
              >
                {p.label ? `${p.label}: ${p.value}` : p.value}
              </a>
            ))}
          </InfoCard>

          <InfoCard title="Email" icon={<MailIcon />}>
            <a href={`mailto:${SITE.email}`} className="break-all text-muted hover:text-brand-700">
              {SITE.email}
            </a>
          </InfoCard>

          <InfoCard title="Coverage" icon={<PinIcon />}>
            <p className="text-muted">Nationwide delivery across the Philippines</p>
          </InfoCard>

          <InfoCard title="Support hours" icon={<ClockIcon />}>
            <p className="text-muted">{SITE.supportLine}</p>
          </InfoCard>

          {/* Tinted rather than outlined, so it reads as a note about the form rather than another
              contact route. brand-50, not the amber accent — amber is reserved for SALE/savings. */}
          <div className="rounded-2xl bg-brand-50 p-5">
            <h2 className="text-sm font-bold text-fg">Bulk &amp; clinic pricing</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Volume discounts are available for consumables and multi-unit equipment orders.
              Mention your expected quantities and we will price accordingly.
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}

/** One contact route: icon, label, and the value(s) beneath it. */
function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="text-brand-600" aria-hidden="true">
          {icon}
        </span>
        <h2 className="text-sm font-bold text-fg">{title}</h2>
      </div>
      <div className="mt-1.5 space-y-0.5 pl-[26px] text-sm">{children}</div>
    </section>
  );
}

/* Inline strokes rather than an icon dependency — four glyphs used once each on one page. */
const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6.6 3.5h-2a1.5 1.5 0 0 0-1.5 1.6A16.5 16.5 0 0 0 18.9 20.9a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.3-1.5l-2.3-.3a1.5 1.5 0 0 0-1.4.6l-.8 1a12.5 12.5 0 0 1-5.5-5.5l1-.8a1.5 1.5 0 0 0 .6-1.4l-.3-2.3a1.5 1.5 0 0 0-1.5-1.3Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2.5" />
      <path d="m3.5 7 7.6 5.3a1.6 1.6 0 0 0 1.8 0L20.5 7" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 21.2s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7v5.2l3.2 1.9" />
    </svg>
  );
}
