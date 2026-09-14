"use client";

import { Children, useEffect, useRef, useState, type RefObject } from "react";

/** The shell both grids use, so a card is the same size wherever it appears. */
export const GRID_CLASS = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";

/**
 * The live column count of a responsive grid, read back off the computed style.
 *
 * Defaults to the widest (lg) count so the first server paint matches desktop — the common case —
 * and the effect corrects it on mount and on every resize. Shared by {@link RowCappedGrid} and
 * `LoadMoreGrid`, both of which think in whole rows rather than a fixed number of cards.
 */
export function useGridColumns(ref: RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (n > 0) setCols(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return cols;
}

/**
 * A grid capped at exactly `rows` rows, whatever the breakpoint — 2 rows is 8 cards on desktop, 6 on
 * tablet, 4 on a phone. Capping by row rather than by a fixed count is the point: a flat "show 8"
 * leaves a ragged half-row at every width the column count doesn't divide.
 *
 * The cards themselves are rendered by the server and passed in as children, so a server component
 * can use this without becoming a client component itself.
 */
export function RowCappedGrid({ children, rows }: { children: React.ReactNode; rows: number }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(gridRef);
  const items = Children.toArray(children);

  return (
    <div ref={gridRef} className={GRID_CLASS}>
      {items.slice(0, rows * cols)}
    </div>
  );
}
