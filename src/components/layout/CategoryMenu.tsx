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
    <div className="gap-x-8 columns-2 sm:columns-3 lg:columns-4">
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
