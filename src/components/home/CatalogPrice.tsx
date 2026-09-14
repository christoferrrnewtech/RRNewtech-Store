"use client";

import { useSetCatalogParam } from "@/components/home/useCatalogParams";

/**
 * Typed price bounds, committed on Enter or on blur.
 *
 * Sits in the toolbar beside Sort rather than in the filter sidebar. It is a filter, but it's a
 * typed range rather than a pick-one-from-a-list, so it read as a foreign object among the sidebar's
 * link rows — and down there, below sixteen category and brand rows, nobody found it.
 *
 * The inputs are uncontrolled and keyed on the current value: a navigation remounts them with the
 * new `defaultValue`, which re-seeds them from the URL without a setState-in-effect.
 */
export function CatalogPrice({ min, max }: { min?: number; max?: number }) {
  const setParam = useSetCatalogParam();
  const active = min !== undefined || max !== undefined;

  function commit(key: "min" | "max", raw: string, current?: number) {
    const value = raw.trim();
    // Nothing changed (including blurring an untouched empty box) — don't push a duplicate entry.
    if (value === (current === undefined ? "" : String(current))) return;
    const n = Number.parseInt(value, 10);
    setParam(key, Number.isFinite(n) && n >= 0 ? String(n) : "");
  }

  const box = (key: "min" | "max", placeholder: string, current?: number) => (
    <span className="inline-flex items-center">
      <span aria-hidden className="text-muted-light">
        ₱
      </span>
      <input
        key={current ?? ""}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        defaultValue={current ?? ""}
        placeholder={placeholder}
        aria-label={`${placeholder === "Min" ? "Minimum" : "Maximum"} price in pesos`}
        onBlur={(e) => commit(key, e.currentTarget.value, current)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(key, e.currentTarget.value, current);
          }
        }}
        // Fixed 64px at every size. Letting these grow to fill the row only made it worse: the
        // "Min"/"Max" placeholders are ~25px, so a wider box just means more empty space after them,
        // which is what reads as a gap in the middle of the control.
        className="w-16 bg-transparent px-1 py-0.5 text-sm font-medium text-fg placeholder:font-normal placeholder:text-muted focus:outline-none"
      />
    </span>
  );

  return (
    <div
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-lg border py-1.5 pl-3 pr-2 text-sm",
        active ? "border-brand-600 bg-brand-50" : "border-line bg-surface",
      ].join(" ")}
    >
      <span className={active ? "font-semibold text-brand-700" : "text-muted"}>Price</span>
      {box("min", "Min", min)}
      <span aria-hidden className="text-muted-light">
        –
      </span>
      {box("max", "Max", max)}
    </div>
  );
}
