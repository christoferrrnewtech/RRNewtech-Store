"use client";

import { Children, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GRID_CLASS, useGridColumns } from "@/components/home/RowGrid";

/**
 * How far below the viewport the sentinel counts as "reached", so the next rows are already in
 * place by the time the reader gets there rather than appearing under them.
 */
const PREFETCH_MARGIN = "600px";

/**
 * Progressive product grid. The card children are rendered on the server (so `BrandProductCard` can
 * stay a server component) and passed in; this client wrapper only controls how many are visible.
 *
 * Reveals whole ROWS, not a fixed product count: it measures the grid's live column count (which is
 * responsive — 2 / 3 / 4) and shows `rowsShown × columns` cards, so the last row is never a partial
 * orphan. The count re-derives on resize.
 *
 * Rows reveal on scroll rather than on a click. Nothing is fetched — every card is already in the
 * page — so this only raises a number, and the button it replaces stays as the fallback for the
 * case where IntersectionObserver isn't available.
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(gridRef);
  const [rowsShown, setRowsShown] = useState(initialRows);

  // Starts true — assumed available rather than detected after mount.
  //
  // Detecting it post-mount meant the server rendered the button, hydration removed it, and every
  // visitor saw a "Load more" flash before it vanished. Assuming the other way costs nothing: the
  // button needs JavaScript for its onClick regardless, so a client that can't run the observer
  // was never served a working button by the server either — it just gets one a moment later.
  const [autoLoads, setAutoLoads] = useState(true);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") setAutoLoads(false);
  }, []);

  const visible = Math.min(rowsShown * cols, total);
  const done = visible >= total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRowsShown((r) => r + stepRows);
      },
      { rootMargin: `0px 0px ${PREFETCH_MARGIN} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
    // `visible` is a dependency on purpose: the observer is rebuilt after every reveal so it
    // re-evaluates immediately. Without that, a step that doesn't push the sentinel out of view
    // (a short row, a tall window) never fires a second entry and the grid stalls mid-list.
  }, [visible, done, stepRows]);

  return (
    <div>
      <div ref={gridRef} className={className}>
        {items.slice(0, visible)}
      </div>

      {!done && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

          <div className="mt-10 flex flex-col items-center gap-3">
            {/* Only when the observer can't do it. Otherwise scrolling — including the scrolling a
                keyboard user causes by tabbing into an offscreen card — reveals the next rows. */}
            {!autoLoads && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setRowsShown((r) => r + stepRows)}
              >
                Load more
              </Button>
            )}
            {/* Polite, so a screen reader hears the count move rather than silently gaining cards. */}
            <p aria-live="polite" className="text-xs text-muted-light">
              Showing {visible} of {total}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
