"use client";

import { Children, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GRID_CLASS, useGridColumns } from "@/components/home/RowGrid";

/**
 * Progressive product grid. The card children are rendered on the server (so `BrandProductCard` can
 * stay a server component) and passed in; this client wrapper only controls how many are visible.
 *
 * Reveals whole ROWS, not a fixed product count: it measures the grid's live column count (which is
 * responsive — 2 / 3 / 4) and shows `rowsShown × columns` cards, so the last row is never a partial
 * orphan. "Load more" adds `stepRows` more rows; the count re-derives on resize.
 */
export function LoadMoreGrid({
  children,
  initialRows = 4,
  stepRows = 2,
  className = GRID_CLASS,
}: {
  children: React.ReactNode;
  initialRows?: number;
  stepRows?: number;
  /** Replaces the shared grid shell — for a narrower column (e.g. beside the /shop sidebar). The
   *  row measurement reads the live column count either way, so it adapts on its own. */
  className?: string;
}) {
  const items = Children.toArray(children);
  const total = items.length;

  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(gridRef);
  const [rowsShown, setRowsShown] = useState(initialRows);

  const visible = Math.min(rowsShown * cols, total);

  return (
    <div>
      <div ref={gridRef} className={className}>
        {items.slice(0, visible)}
      </div>

      {visible < total && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setRowsShown((r) => r + stepRows)}
          >
            Load more
          </Button>
          <p className="text-xs text-muted-light">
            Showing {visible} of {total}
          </p>
        </div>
      )}
    </div>
  );
}
