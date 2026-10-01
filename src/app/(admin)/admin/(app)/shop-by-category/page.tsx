import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCategories, getCategoriesWithCounts } from "@/lib/content";
import { HOME_CATEGORY_LIMIT } from "@/components/home/CategoryGrid";
import Link from "next/link";
import { PageHeader } from "@/components/admin/Panel";
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
      <PageHeader
        title="Shop by category"
        description="The tile grid on the home page. Give each tile a photo here. Which categories appear, and in what order, follows how many products they hold."
        actions={
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            View home page ↗
          </Link>
        }
      />

      <TilesManager
        shown={categories.slice(0, HOME_CATEGORY_LIMIT)}
        hidden={categories.slice(HOME_CATEGORY_LIMIT)}
        empty={empty}
        limit={HOME_CATEGORY_LIMIT}
      />
    </div>
  );
}
