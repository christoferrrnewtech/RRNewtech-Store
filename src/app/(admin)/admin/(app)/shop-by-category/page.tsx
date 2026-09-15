import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCategories, getCategoriesWithCounts } from "@/lib/content";
import { HOME_CATEGORY_LIMIT } from "@/components/home/CategoryGrid";
import { TilesManager } from "./TilesManager";

export const metadata: Metadata = { title: "Shop by category" };

/**
 * Editor for the landing page's "Shop by category" grid.
 *
 * Reads through the same `getCategoriesWithCounts` the storefront grid uses and splits it on the
 * same limit, so what's listed as "on the landing page" is what is on the landing page — rather
 * than a second guess at the rule that drifts the moment either side changes.
 */
export default async function AdminShopByCategoryPage() {
  await requireAdmin();
  const [categories, all] = await Promise.all([
    getCategoriesWithCounts().catch(() => []),
    getCategories().catch(() => []),
  ]);

  // `getCategoriesWithCounts` drops anything with no products, so an empty category would appear
  // in neither list above — invisible here with no reason given. Listed separately instead.
  const stocked = new Set(categories.map((c) => c.slug));
  const empty = all.filter((c) => !stocked.has(c.slug));

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Shop by category
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        The tile grid on the landing page. Add a photo to any tile here — without one it falls back
        to a plain blue panel. Which categories appear, and in what order, follows their product
        counts, so it isn&apos;t set by hand.
      </p>

      <TilesManager
        shown={categories.slice(0, HOME_CATEGORY_LIMIT)}
        hidden={categories.slice(HOME_CATEGORY_LIMIT)}
        empty={empty}
        limit={HOME_CATEGORY_LIMIT}
      />
    </div>
  );
}
