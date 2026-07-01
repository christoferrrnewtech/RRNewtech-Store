"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/products";

/**
 * Sort control for the catalog. Category selection lives in the CategoryCircles browser above,
 * so this only owns the sort param. Reads/writes the URL so the server component does the work.
 */
export function ShopControls({ activeSort }: { activeSort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || (key === "sort" && value === "featured")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center justify-start border-b border-line pb-5">
      <label className="flex items-center gap-2 text-sm text-muted">
        <span className="whitespace-nowrap">Sort by</span>
        <select
          value={activeSort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-fg"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
