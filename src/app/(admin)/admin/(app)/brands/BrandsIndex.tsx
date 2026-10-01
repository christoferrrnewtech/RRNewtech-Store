"use client";

import { useState } from "react";
import { PageHeader, Panel } from "@/components/admin/Panel";
import { BrandRail, type RailBrand } from "./BrandRail";
import { NewBrandForm } from "./NewBrandForm";

/**
 * Brands manage page. The header carries "Add a brand" (admins), which opens the create panel
 * inline; below is every brand in storefront order, reorderable by admins. Marketing users get a
 * read-only list of the brands assigned to them.
 */
export function BrandsIndex({
  brands,
  canManage,
}: {
  brands: RailBrand[];
  canManage: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const published = brands.filter((b) => b.status === "published").length;

  return (
    <div>
      <PageHeader
        title="Brands"
        description={
          canManage
            ? `${published} published · ${brands.length - published} draft. The order below is the order shoppers see them in.`
            : "The brands assigned to you. Edits go live once the brand is published."
        }
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              aria-expanded={showCreate}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                showCreate
                  ? "border border-line bg-surface text-fg hover:bg-elevated"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={showCreate ? "M6 6l12 12M18 6L6 18" : "M12 5v14M5 12h14"}
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              {showCreate ? "Cancel" : "Add a brand"}
            </button>
          )
        }
      />

      {canManage && showCreate && (
        <div className="mb-6">
          <NewBrandForm />
        </div>
      )}

      <Panel
        title={canManage ? "Storefront order" : "Your brands"}
        description={canManage ? "Drag a row, or use the arrows, to change the order." : undefined}
        padded={false}
      >
        <BrandRail brands={brands} canReorder={canManage} />
      </Panel>
    </div>
  );
}
