import { CatalogPrice } from "@/components/home/CatalogPrice";
import { CatalogSort } from "@/components/home/CatalogSort";

/**
 * The catalog's toolbar controls — Price and Sort — rendered opposite the result count.
 *
 * One component rather than the same three lines in both /shop and the category page, so the
 * responsive behaviour lives in one place.
 *
 * `w-full sm:w-auto` is load-bearing: the toolbar is a flex item, so without it this box would
 * shrink to fit its content and the `w-full` on each control below would resolve against nothing.
 * On a phone the controls fill the row; from `sm` up they return to their intrinsic widths, which is
 * what the desktop bar is built around.
 */
export function CatalogToolbar({
  min,
  max,
  sort,
}: {
  min?: number;
  max?: number;
  sort?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CatalogPrice min={min} max={max} />
      <CatalogSort sort={sort} />
    </div>
  );
}
