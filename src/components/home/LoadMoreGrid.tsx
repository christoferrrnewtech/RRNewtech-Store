"use client";

import { Children, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Progressive product grid. The card children are rendered on the server (so `BrandProductCard` can
 * stay a server component) and passed in; this client wrapper only controls how many are visible.
 * Shows `initial` cards, then a "Load more" button reveals `step` more per click until all are shown.
 */
export function LoadMoreGrid({
  children,
  initial = 16,
  step = 16,
}: {
  children: React.ReactNode;
  initial?: number;
  step?: number;
}) {
  const items = Children.toArray(children);
  const [visible, setVisible] = useState(initial);
  const total = items.length;
  const shown = Math.min(visible, total);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.slice(0, visible)}
      </div>

      {visible < total && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setVisible((v) => v + step)}
          >
            Load more
          </Button>
          <p className="text-xs text-muted-light">
            Showing {shown} of {total}
          </p>
        </div>
      )}
    </div>
  );
}
