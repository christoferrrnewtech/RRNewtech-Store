"use client";

import { useState } from "react";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { facetValue, type BrandFacets } from "@/lib/brand-facets";
import type { BrandProduct } from "@/lib/content";

/**
 * A brand's product grid with optional filter chips above it. Picking a category reveals a second
 * row with that category's subcategories, so deep catalogues can be narrowed twice.
 *
 * Filtering runs client-side rather than through a `?param` on purpose: this page is statically
 * prerendered via generateStaticParams, and reading searchParams would push it to dynamic rendering
 * and cost the prerendered HTML on an SEO-relevant page. Every product is already in the payload,
 * so narrowing is instant. The cost is that the filter isn't shareable by URL, which is a fair
 * trade for an on-page filter over a few dozen items.
 */
export function BrandProducts({
  products,
  brandName,
  brandSlug,
  brandLogo,
  facets,
}: {
  products: BrandProduct[];
  brandName: string;
  brandSlug: string;
  brandLogo: string;
  facets: BrandFacets;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);

  const shown = products.filter((p) => {
    if (activeCat && p.category !== activeCat) return false;
    if (activeSub && facetValue(p, "subcategory") !== activeSub) return false;
    return true;
  });

  // Only worth a second row when there's an actual choice in it — a lone subcategory would just
  // restate the category you already picked.
  const drilldown =
    facets.mode === "categories"
      ? facets.categories.find((c) => c.value === activeCat && c.subs.length >= 2)
      : undefined;

  return (
    <>
      {facets.mode === "categories" && (
        <ChipRow className="mt-5">
          <Chip
            active={activeCat === null}
            onClick={() => {
              setActiveCat(null);
              setActiveSub(null);
            }}
          >
            All <Count>{products.length}</Count>
          </Chip>
          {facets.categories.map((c) => (
            <Chip
              key={c.value}
              active={activeCat === c.value}
              onClick={() => {
                setActiveCat(c.value);
                // Drop any subcategory from the previous category, or it filters to nothing.
                setActiveSub(null);
              }}
            >
              {c.label} <Count>{c.count}</Count>
            </Chip>
          ))}
        </ChipRow>
      )}

      {drilldown && (
        <ChipRow className="mt-2 sm:ml-2 sm:border-l-2 sm:border-line sm:pl-3">
          <Chip active={activeSub === null} onClick={() => setActiveSub(null)}>
            All <Count>{drilldown.count}</Count>
          </Chip>
          {drilldown.subs.map((s) => (
            <Chip key={s.value} active={activeSub === s.value} onClick={() => setActiveSub(s.value)}>
              {s.label} <Count>{s.count}</Count>
            </Chip>
          ))}
        </ChipRow>
      )}

      {facets.mode === "subcategories" && (
        <ChipRow className="mt-5">
          <Chip active={activeSub === null} onClick={() => setActiveSub(null)}>
            All <Count>{products.length}</Count>
          </Chip>
          {facets.subcategories.map((s) => (
            <Chip key={s.value} active={activeSub === s.value} onClick={() => setActiveSub(s.value)}>
              {s.label} <Count>{s.count}</Count>
            </Chip>
          ))}
        </ChipRow>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <BrandProductCard
            key={p.id}
            product={p}
            brandName={brandName}
            brandSlug={brandSlug}
            brandLogo={brandLogo}
          />
        ))}
      </div>
    </>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="opacity-60">{children}</span>;
}

/**
 * Chips scroll as one row on phones — a brand with eight long subcategory labels would
 * otherwise wrap into ~7 near-full-width rows and push the products off screen — and wrap
 * normally from sm up, where they fit. The negative inline margin bleeds the row to the
 * screen edge (matching Container's mobile px-4) so a half-visible chip signals there's more
 * to swipe. -my-1/py-1 keeps focus rings from being clipped by overflow-x without changing
 * the vertical rhythm.
 */
function ChipRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="-mx-4 -my-1 flex gap-2 overflow-x-auto scroll-smooth px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

/** Same look as the category-page chips, as a button since this filters in place. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        // shrink-0/nowrap: inside the mobile scroller flex would otherwise squeeze the pills
        // and wrap their labels onto two lines.
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-fg hover:border-brand-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
