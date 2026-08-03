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
            <Image src={brand.logo} alt="" fill sizes="44px" className="object-contain p-1.5" />
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
          <Link
            href={`/brands/${brand.slug}`}
            target="_blank"
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View live ↗
          </Link>
        </div>
      </div>
    </>
  );
}
