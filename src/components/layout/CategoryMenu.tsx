import Link from "next/link";

export type MenuCategory = {
  slug: string;
  name: string;
  subcategories: { slug: string; name: string }[];
};

/**
 * Category mega-menu panel: each admin-managed category is a heading linking to its page, with its
 * subcategories listed beneath (linking to the category page filtered by ?sub=). Flows into CSS
 * columns so any number of categories wraps tidily. Presentational — the header owns open/close.
 *
 * Columns rather than one long list because this tree is big and getting bigger: 6 categories and 16
 * subcategories are stocked today, out of a taxonomy of 26 and 226. Stacked vertically that's
 * already ~700px, which overflows a laptop screen; in four columns it's ~250px.
 *
 * `columns-1` at the base size is for the mobile drawer, which renders this same component — two
 * columns on a 400px phone left ~170px per category, not enough for "Equipment – Chairs, Compressor,
 * HV Suction". The desktop panel is `lg` and still gets its four.
 */
export function CategoryMenu({
  categories,
  onNavigate,
}: {
  categories: MenuCategory[];
  onNavigate?: () => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="gap-x-8 columns-1 sm:columns-2 lg:columns-4">
      {categories.map((cat) => (
        <div key={cat.slug} className="mb-6 break-inside-avoid">
          <Link
            href={`/categories/${cat.slug}`}
            onClick={onNavigate}
            className="mb-2 block text-sm font-bold text-fg hover:text-brand-700"
          >
            {cat.name}
          </Link>
          {cat.subcategories.length > 0 && (
            <ul className="space-y-1.5">
              {cat.subcategories.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    href={`/categories/${cat.slug}?sub=${sub.slug}`}
                    onClick={onNavigate}
                    className="text-sm text-muted hover:text-brand-700"
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
