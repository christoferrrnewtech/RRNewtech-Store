import Link from "next/link";
import { BRANDS } from "@/lib/products";

/**
 * Brand mega-menu panel: the canonical brand list, each linking to its filtered view
 * (/?brand=slug). Presentational — the header owns open/close state.
 */
export function BrandMenu({ onNavigate }: { onNavigate?: () => void }) {
  const brands = BRANDS;

  return (
    <div>
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-brand-600">
        Shop by brand
      </p>
      <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/?brand=${b.slug}`}
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
