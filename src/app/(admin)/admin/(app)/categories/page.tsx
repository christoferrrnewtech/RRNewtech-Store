import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCategories } from "@/lib/content";
import { PageHeader } from "@/components/admin/Panel";
import { CategoriesManager } from "./CategoriesManager";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await getCategories();

  return (
    <div>
      <PageHeader
        title="Categories"
        description="The storefront's Categories menu, and the categories a product can be tagged with. Pick one on the left to edit its subcategories and home tile."
      />

      <CategoriesManager categories={categories} />
    </div>
  );
}
