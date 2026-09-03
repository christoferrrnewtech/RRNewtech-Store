"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type FilterOption = { slug: string; name: string };

/** Sort choices for the catalog grid. "" is Featured — the curated brand order, and the default. */
const SORT_CHOICES = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "quote-first", label: "Quote on request first" },
];

/**
 * The homepage catalog filter row: Category · Brand · a typed price range · Sort.
 *
 * State lives in the URL (`?category=&brand=&min=&max=&sort=`) so the server does the filtering and
 * a filtered view stays shareable, matching how search already works. Options are resolved by the
 * server parent (HomeCatalog), so this stays presentational.
 */
export function CatalogFilters({
  categories,
  brands,
  category,
  brand,
  min,
  max,
  sort,
}: {
  categories: FilterOption[];
  brands: FilterOption[];
  category?: string;
  brand?: string;
  min?: number;
  max?: number;
  sort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const anyActive = Boolean(
    category || brand || sort || min !== undefined || max !== undefined,
  );

  function push(next: URLSearchParams) {
    const qs = next.toString();
    // scroll: false — the controls sit at the section header, so staying put is right.
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    for (const key of ["category", "brand", "min", "max", "sort"]) next.delete(key);
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Category"
        value={category ?? ""}
        allLabel="All categories"
        options={categories.map((c) => ({ value: c.slug, label: c.name }))}
        onChange={(v) => setParam("category", v)}
        // The only genuinely long values — one category name runs 42 characters. 16rem fits all but
        // that one; the tighter mobile cap keeps the pill inside a 375px viewport.
        widthClass="max-w-40 sm:max-w-64"
      />
      <FilterSelect
        label="Brand"
        value={brand ?? ""}
        allLabel="All brands"
        options={brands.map((b) => ({ value: b.slug, label: b.name }))}
        onChange={(v) => setParam("brand", v)}
      />

      <PriceRange min={min} max={max} onCommit={setParam} />

      <FilterSelect
        label="Sort"
        value={sort ?? ""}
        allLabel="Featured"
        options={SORT_CHOICES}
        onChange={(v) => setParam("sort", v)}
      />

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-elevated hover:text-brand-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/**
 * Typed price bounds, committed on Enter or on blur.
 *
 * The inputs are uncontrolled and keyed on the current value: a navigation remounts them with the
 * new `defaultValue`, which re-seeds them from the URL without a setState-in-effect.
 */
function PriceRange({
  min,
  max,
  onCommit,
}: {
  min?: number;
  max?: number;
  onCommit: (key: string, value: string) => void;
}) {
  const active = min !== undefined || max !== undefined;

  function commit(key: "min" | "max", raw: string, current?: number) {
    const value = raw.trim();
    // Nothing changed (including blurring an untouched empty box) — don't push a duplicate entry.
    if (value === (current === undefined ? "" : String(current))) return;
    const n = Number.parseInt(value, 10);
    onCommit(key, Number.isFinite(n) && n >= 0 ? String(n) : "");
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
        className="w-16 bg-transparent px-1 py-0.5 text-sm font-medium text-fg placeholder:font-normal placeholder:text-muted focus:outline-none"
      />
    </span>
  );

  return (
    <div
      className={[
        "inline-flex items-center gap-1 rounded-full border py-1.5 pl-3 pr-2 text-sm",
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

/**
 * One filter pill. The label stays visible so the row reads as named filters, not blanks.
 *
 * No width cap by default — Brand and Sort values are short and a cap only ever clips them. Pass
 * `widthClass` for a control whose values genuinely run long (Category). `truncate` is always on so
 * that when a cut does happen it shows an ellipsis and reads as deliberate rather than broken.
 */
function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
  widthClass = "",
}: {
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  widthClass?: string;
}) {
  const active = Boolean(value);
  return (
    <label
      className={[
        "inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-sm",
        active ? "border-brand-600 bg-brand-50" : "border-line bg-surface",
      ].join(" ")}
    >
      <span className={active ? "font-semibold text-brand-700" : "text-muted"}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={[
          "truncate cursor-pointer bg-transparent py-0.5 pr-1 text-sm font-medium text-fg focus:outline-none",
          widthClass,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
