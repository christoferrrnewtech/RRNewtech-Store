import Image from "next/image";
import Link from "next/link";
import { StatusPill } from "@/app/(admin)/admin/(app)/page";
import type { Brand } from "@/lib/content";

/**
 * Compact editor header: which brand, its status, and a jump to the live page. Shared by the brand
 * editor and its Products sub-page so the two don't drift apart.
 */
export function BrandHeader({
  brand,
  backHref = "/admin/brands",
  backLabel = "← All brands",
}: {
  brand: Brand;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <>
      {/* Back link on mobile (on desktop the sidebar's Brands group handles switching). */}
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 lg:hidden"
      >
        {backLabel}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
            <Image
              src={brand.logo}
              alt=""
              fill
              sizes="44px"
              className="object-contain p-1.5"
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              {brand.name}
            </h2>
            <p className="truncate text-xs text-muted">/brands/{brand.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={brand.status} />
          {/* A draft brand has no live page — getBrandBySlug hides it, so /brands/[slug] 404s.
              Linking anyway sent the admin to a 404 and, worse, Next.js prefetched that URL as
              soon as the header scrolled into view, logging a 404 in the console on every visit
              to a draft brand's editor. prefetch={false} because the link opens in a new tab,
              where a warmed router cache buys nothing. */}
          {brand.status === "published" ? (
            <Link
              href={`/brands/${brand.slug}`}
              target="_blank"
              prefetch={false}
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View live ↗
            </Link>
          ) : (
            <span
              className="text-sm font-semibold text-muted-light"
              title="Publish this brand to give it a live page"
            >
              View live ↗
            </span>
          )}
        </div>
      </div>
    </>
  );
}
