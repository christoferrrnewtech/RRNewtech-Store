import Image from "next/image";
import Link from "next/link";
import { StatusPill } from "@/components/admin/StatusPill";
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
    <header className="mb-2">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand-700"
      >
        {backLabel}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
            {brand.logo && (
              <Image src={brand.logo} alt="" fill sizes="80px" className="object-contain p-2" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
                {brand.name}
              </h1>
              <StatusPill status={brand.status} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">
              /brands/{brand.slug} · {brand.products.length} product
              {brand.products.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

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
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            View live page ↗
          </Link>
        ) : (
          <span
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2 text-sm font-semibold text-muted-light"
            title="Publish this brand to give it a live page"
          >
            Not live yet
          </span>
        )}
      </div>
    </header>
  );
}
