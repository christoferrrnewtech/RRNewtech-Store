import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCategories } from "@/lib/content";
import { CategoriesManager } from "./CategoriesManager";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await getCategories();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Categories
      </h1>
      <p className="mt-2 text-muted">
        Create, rename, and delete categories and their subcategories. These drive the storefront
        Categories menu and the category a product can be tagged with.
      </p>

      <CategoriesManager categories={categories} />
    </div>
  );
}
