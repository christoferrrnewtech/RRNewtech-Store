"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

export type FilterOption = { slug: string; name: string };

/**
 * The catalog's filter sidebar: Categories · Brands.
 *
 * A sidebar rather than a row of dropdowns because the whole taxonomy is small enough to show at
 * once — a shopper can see what's stocked without opening a select to find out, and filtering is one
 * click.
 *
 * Two catalog controls live in the toolbar above the grid instead: Sort, which decides the order of
 * the list rather than its membership, and Price (see CatalogPrice), which is a typed range rather
 * than a pick-one-from-a-list and was going unfound at the foot of these two long lists.
 *
 * State lives in the URL (`?category=&brand=`) so the server does the filtering and a filtered view
 * stays shareable. `min`/`max` are still accepted, but only so "Clear all" appears when a price set
 * from the toolbar is the sole active filter. Options are resolved by the server parent
 * (HomeCatalog), so this stays presentational.
 */
export function CatalogFilters({
  categories,
  brands,
  category,
  brand,
}: {
  categories: FilterOption[];
  brands: FilterOption[];
  /** The category currently in scope — from the path on a category page, unset on /shop. */
  category?: string;
  brand?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  // Read from the params rather than the props: `category` is deliberately excluded, because on a
  // category page it comes from the PATH and is always set — counting it would leave "Clear all"
  // permanently on screen with nothing to clear. Includes `sub`, which only exists there.
  const anyActive = ["brand", "min", "max", "sub"].some((key) => params.get(key));

  // Labels the mobile disclosure button. Counts only what the PANEL holds — price lives in the
  // toolbar now, so counting it would promise something this panel doesn't contain.
  const activeCount = (category ? 1 : 0) + (brand ? 1 : 0);

  // Drawer state, mobile only. Starts closed: unlike the old inline disclosure, an overlay that
  // opened itself on load would cover the results a shared filtered link was meant to show.
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Lock the page behind the drawer, and close on Escape — mirroring CartDrawer.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function urlFor(next: URLSearchParams) {
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  /**
   * The href for setting (or, with "", clearing) one param.
   *
   * Real links rather than buttons: a filtered view is a URL, so it should be middle-clickable,
   * openable in a new tab and crawlable. The old `<select>` + router.push could be none of those.
   */
  function hrefFor(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    return urlFor(next);
  }

  const clearAllHref = (() => {
    const next = new URLSearchParams(params.toString());
    // `sub` matters on a category page; the rest are no-ops there or on /shop as the case may be.
    for (const key of ["category", "brand", "min", "max", "sub"]) next.delete(key);
    return urlFor(next);
  })();

  /**
   * The filter groups themselves. Rendered twice — in flow for desktop, inside the drawer for
   * mobile — so `onNavigate` closes the drawer when a row is tapped. Every row is a Link, so a tap
   * navigates; without this the drawer would stay open over the new results.
   */
  const panel = (
    <>
      {/* Categories NAVIGATE — a category is a page of its own (/categories/<slug>), with its own
          title, subcategory chips and a place in the sitemap. Filtering in place here would give
          the same category a second URL. Brands and Price below stay params on whichever page
          this sidebar is rendered on. */}
      <FilterGroup title="Categories">
        <FilterRow href="/shop" active={!category} onNavigate={close}>
          All categories
        </FilterRow>
        {categories.map((c) => (
          <FilterRow
            key={c.slug}
            href={`/categories/${c.slug}`}
            active={category === c.slug}
            onNavigate={close}
          >
            {c.name}
          </FilterRow>
        ))}
      </FilterGroup>

      <FilterGroup title="Brands">
        <FilterRow href={hrefFor("brand", "")} active={!brand} onNavigate={close}>
          All brands
        </FilterRow>
        {brands.map((b) => (
          <FilterRow
            key={b.slug}
            href={hrefFor("brand", b.slug)}
            active={brand === b.slug}
            onNavigate={close}
          >
            {b.name}
          </FilterRow>
        ))}
      </FilterGroup>

      {anyActive && (
        <Link
          href={clearAllHref}
          scroll={false}
          onClick={close}
          className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Clear all
        </Link>
      )}
    </>
  );

  return (
    <aside aria-label="Filter products">
      {/* Mobile trigger. Opens a drawer rather than expanding in place: the full list is ~1000px,
          which shoved the count, the toolbar and every product off a phone screen. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={[
          "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold lg:hidden",
          activeCount > 0
            ? "border-brand-600 bg-brand-50 text-brand-700"
            : "border-line bg-surface text-fg",
        ].join(" ")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop: in flow beside the grid. */}
      <div className="hidden lg:block">{panel}</div>

      {/* Mobile: the same panel as a slide-over. Left-hand side, where the sidebar lives — the cart
          drawer comes from the right, since a cart does. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={close}
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className={`absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-surface shadow-xl transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-bold text-fg">Filters</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close filters"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg hover:bg-elevated"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* The list scrolls in here, so the page behind never moves. */}
          <div className="flex-1 overflow-y-auto px-5 py-5">{panel}</div>

          <div className="border-t border-line px-5 py-4">
            <Button type="button" onClick={close} className="w-full">
              Show results
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-light">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterRow({
  href,
  active,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  /** Closes the mobile drawer — a tap navigates, so it mustn't stay open over the new results. */
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={onNavigate}
      aria-current={active ? "true" : undefined}
      className={[
        "block py-1.5 text-sm leading-snug",
        active ? "font-semibold text-brand-700" : "text-muted hover:text-brand-700",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
