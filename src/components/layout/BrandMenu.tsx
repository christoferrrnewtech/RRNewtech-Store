import Link from "next/link";

/** Slug + name only — the minimum the menu needs, passed down from the store layout. */
export type BrandLink = { slug: string; name: string };

/**
 * Brand mega-menu panel: the published brand list, each linking to its brand page
 * (/brands/slug). Presentational — the header owns open/close state, and the store layout
 * supplies the brands (the content store is server-only).
 */
export function BrandMenu({
  brands,
  onNavigate,
}: {
  brands: BrandLink[];
  onNavigate?: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-brand-600">
        Shop by brand
      </p>
      <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/brands/${b.slug}`}
              onClick={onNavigate}
              className="text-sm text-muted hover:text-brand-700"
            >
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
