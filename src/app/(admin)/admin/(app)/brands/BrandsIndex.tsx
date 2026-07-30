"use client";

import { useState } from "react";
import { BrandRail, type RailBrand } from "./BrandRail";
import { NewBrandForm } from "./NewBrandForm";

/**
 * Brands manage page. Header carries "Add a brand" (admins) which toggles the inline create panel;
 * below is the storefront-order list (reordering lives here now that the sidebar owns quick-nav).
 * Marketing users get a read-only list of the brands assigned to them.
 */
export function BrandsIndex({
  brands,
  canManage,
}: {
  brands: RailBrand[];
  canManage: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">Brands</h1>
          <p className="mt-1 text-muted">
            {canManage
              ? "Add a new brand, or drag to reorder how they appear on the storefront. New brands start as drafts."
              : "The brands assigned to you. Edits go live once the brand is published."}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            aria-expanded={showCreate}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={showCreate ? "M6 6l12 12M18 6L6 18" : "M12 5v14M5 12h14"}
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            {showCreate ? "Close" : "Add a brand"}
          </button>
        )}
      </div>

      {canManage && showCreate && (
        <div className="mt-6">
          <NewBrandForm />
        </div>
      )}

      <div className="mt-8">
        {canManage && brands.length > 0 && (
          <h2 className="mb-3 text-sm font-semibold text-fg">
            Storefront order
            <span className="ml-2 font-normal text-muted">— drag or use the arrows</span>
          </h2>
        )}
        <BrandRail brands={brands} canCreate={false} canReorder={canManage} />
      </div>
    </div>
  );
}
