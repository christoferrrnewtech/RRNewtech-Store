"use client";

import { Children, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

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
}: {
  children: React.ReactNode;
  initialRows?: number;
  stepRows?: number;
}) {
  const items = Children.toArray(children);
  const total = items.length;

  const gridRef = useRef<HTMLDivElement>(null);
  // Default to the widest (lg) column count so the first server paint matches desktop, the common
  // case; the effect corrects it to the real count on mount and on resize.
  const [cols, setCols] = useState(4);
  const [rowsShown, setRowsShown] = useState(initialRows);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (n > 0) setCols(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = Math.min(rowsShown * cols, total);

  return (
    <div>
      <div ref={gridRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
