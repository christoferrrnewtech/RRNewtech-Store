"use client";

import { useSetCatalogParam } from "@/components/home/useCatalogParams";

/** Sort choices for the catalog grid. "" is Featured — the curated brand order, and the default. */
const SORT_CHOICES = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "quote-first", label: "Quote on request first" },
];

/**
 * The catalog's sort control.
 *
 * Sits above the grid rather than in the filter sidebar, because it does a different job: the
 * sidebar decides what is IN the list, this decides the ORDER of it. Keeping them apart also means
 * one copy of this control instead of the two-per-breakpoint arrangement the old filter row needed.
 *
 * State lives in `?sort=`, like every other catalog control, so a sorted view stays shareable.
 */
export function CatalogSort({ sort }: { sort?: string }) {
  const setParam = useSetCatalogParam();
  const active = Boolean(sort);

  return (
    <label
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-1.5 text-sm",
        active ? "border-brand-600 bg-brand-50" : "border-line bg-surface",
      ].join(" ")}
    >
      <span className={active ? "font-semibold text-brand-700" : "text-muted"}>Sort</span>
      <select
        value={sort ?? ""}
        onChange={(e) => setParam("sort", e.target.value)}
        aria-label="Sort"
        // Capped on small screens. A native select takes its intrinsic width from its WIDEST option
        // — "Quote on request first" — so this pill was ~230px whatever was selected, which is most
        // of a phone's row. `truncate` alone did nothing, since without a width bound the element
        // already fits its content; `min-w-0` is needed too, or the flex item's default
        // `min-width: auto` refuses to shrink below that intrinsic width.
        className="min-w-0 max-w-32 cursor-pointer truncate bg-transparent py-0.5 pr-1 text-sm font-medium text-fg focus:outline-none sm:max-w-none"
      >
        <option value="">Featured</option>
        {SORT_CHOICES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
