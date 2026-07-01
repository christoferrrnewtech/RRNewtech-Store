import Link from "next/link";
import { CATEGORY_GROUPS } from "@/lib/constants";
import { CATEGORY_MAP } from "@/lib/products";

/**
 * Category mega-menu panel: parent groups (from CATEGORY_GROUPS) each listing their categories
 * as links to the filtered catalog. Presentational — the header owns open/close state.
 */
export function CategoryMenu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3 lg:grid-cols-5">
      {CATEGORY_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-600">
            {group.title}
          </p>
          <ul className="space-y-2">
            {group.slugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/?category=${slug}`}
                  onClick={onNavigate}
                  className="text-sm text-muted hover:text-brand-700"
                >
                  {CATEGORY_MAP[slug].name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
