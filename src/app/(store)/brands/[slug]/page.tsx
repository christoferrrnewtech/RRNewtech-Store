import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { getBrandBySlug, getBrands, youtubeEmbedId } from "@/lib/content";
import { SITE } from "@/lib/constants";

// Pre-render every published brand page at build time (indexable HTML). Falls back to on-demand
// rendering if Firestore isn't reachable at build (e.g. before credentials are configured).
export async function generateStaticParams() {
  try {
    return (await getBrands()).map((b) => ({ slug: b.slug }));
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
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Brand not found" };

  const title = `${brand.name} — Dental Products in the Philippines`;
  return {
    title,
    description: brand.blurb,
    alternates: { canonical: `/brands/${brand.slug}` },
    openGraph: {
      type: "website",
      title,
      description: brand.blurb,
      images: [{ url: `${SITE.url}${brand.heroImage ?? brand.logo}` }],
    },
  };
}

/**
 * Brand landing page. Sections render in the order the admin editor presents them, and each is
 * skipped when empty — so a half-filled brand still reads as a finished page. Draft brands are
 * not published: getBrandBySlug returns undefined and this 404s.
 */
export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const products = brand.products;
  const videoId = youtubeEmbedId(brand.youtubeUrl);

  // Small logo + name/tagline + Shop CTA — shared by the 2-column (with hero) and bar (no hero) layouts.
  const headerInfo = (
    <div className="flex flex-wrap items-center gap-4 sm:gap-5">
      {/* Logos carry their own backgrounds, so they sit contained on a white plate. */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-white sm:h-20 sm:w-20">
        <Image
          src={brand.logo}
          alt={brand.name}
          fill
          sizes="80px"
          className="object-contain p-2.5"
          priority={!brand.heroImage}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Brand</p>
        <h1 className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-fg sm:text-3xl">
          {brand.name}
        </h1>
        {brand.tagline && <p className="mt-1 text-muted">{brand.tagline}</p>}
      </div>
      {products.length > 0 && (
        <LinkButton href="#brand-products" className="shrink-0">
          Shop {brand.name}
        </LinkButton>
      )}
    </div>
  );

  return (
    <>
      <Container className="py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span className="mx-2 text-line-strong">/</span>
          <Link href="/brands" className="hover:text-brand-700">Brands</Link>
        </nav>

        {/* Header — with a hero: two columns (hero left, logo+info right); without: the info bar. */}
        {brand.heroImage ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-elevated">
              <Image
                src={brand.heroImage}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover"
                priority
              />
            </div>
            <div className="flex items-center rounded-2xl border border-line bg-surface p-6 sm:p-8">
              {headerInfo}
            </div>
          </div>
        ) : (
          <div className="border-b border-line pb-6">{headerInfo}</div>
        )}

        {brand.blurb && (
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">{brand.blurb}</p>
        )}

        {/* 3 · About the brand */}
        {brand.about.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              About {brand.name}
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
              {brand.about.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* 4 · Embedded YouTube video */}
        {videoId && (
          <section className="mt-14">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              Watch {brand.name} in action
            </h2>
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-line bg-ink">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={`${brand.name} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {/* 5 · Image gallery */}
        {brand.gallery.length > 0 && (
          <section className="mt-14">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              Gallery
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brand.gallery.map((img) => (
                <figure
                  key={img.src}
                  className="overflow-hidden rounded-2xl border border-line bg-surface"
                >
                  <div className="relative aspect-[4/3] bg-elevated">
                    <Image
                      src={img.src}
                      alt={img.caption ?? ""}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                      className="object-cover"
                    />
                  </div>
                  {img.caption && (
                    <figcaption className="px-4 py-3 text-sm text-muted">{img.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* 6 · Products */}
        {products.length > 0 && (
          <section id="brand-products" className="mt-16 scroll-mt-24">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              {brand.name} products
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
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

        {/* 7 · Why choose this brand */}
        {brand.whyChoose.length > 0 && (
          <section className="mt-16">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              Why choose {brand.name}?
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brand.whyChoose.map((reason) => (
                <div key={reason.title} className="rounded-2xl border border-line bg-surface p-6">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-brand-600"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12l4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h3 className="mt-3 font-semibold text-fg">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{reason.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8 · Contact sales / book demo + official site */}
        <section className="mt-16 rounded-2xl border border-line bg-surface p-8 text-center sm:p-12">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
            {brand.cta.heading}
          </h2>
          {brand.cta.body && <p className="mx-auto mt-3 max-w-xl text-muted">{brand.cta.body}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/contact" size="lg">
              Contact sales
            </LinkButton>
            {brand.cta.websiteUrl && (
              <a
                href={brand.cta.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-line-strong hover:bg-elevated"
              >
                {brand.cta.buttonLabel || "Visit Official Website"} ↗
              </a>
            )}
          </div>

          {brand.cta.websiteUrl && (
            <p className="mt-5 text-sm text-muted">
              Visit the official {brand.name} website →{" "}
              <a
                href={brand.cta.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                {brand.cta.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
        </section>

        <p className="mt-12 text-xs text-muted-light">
          Prices are in Philippine pesos. Availability and lead times confirmed at order. Looking
          for a {brand.name} item not listed here? Email {SITE.email}.
        </p>
      </Container>
    </>
  );
}
