import Link from "next/link";
import type { HomeView } from "@/components/home/HomeCatalog";
import { getBrands } from "@/lib/content";

/**
 * The homepage catalog view switcher, as a "pick one" pair of radio cards.
 *
 * Two earlier shapes failed informal testing: a small segmented pill (nobody saw it) and two large
 * filled banner cards (people read them but didn't click — a solid block of centred text reads as a
 * section header, not a control). So this leads with a framing question and marks each option with
 * a radio dot, which is the strongest "choose one" signal there is and needs no hover to discover.
 *
 * State still lives in the `?view=` URL param — server-rendered and shareable, matching how
 * category/brand/sort/search already work.
 */
export async function HomeViewCards({ view }: { view: HomeView }) {
  const brands = await getBrands().catch(() => []);
  // Both counts must match what each view actually renders, or the cards misreport the catalog.
  // Mirrors the filter in BrandRailsSection.
  const brandCount = brands.filter(
    (b) => b.featuredOnHome !== false && b.products.length > 0,
  ).length;
  // Mirrors the flatten in AllProductsGrid.
  const productCount = brands.reduce((n, b) => n + b.products.length, 0);

  return (
    <div>
      <p id="catalog-view-label" className="mb-3 text-sm font-semibold text-fg">
        How do you want to browse?
      </p>
      <div
        role="group"
        aria-labelledby="catalog-view-label"
        className="grid gap-4 sm:grid-cols-2"
      >
        <ViewCard
          href="/"
          active={view === "by-brand"}
          title="Shop by Brand"
          meta={brandCount > 0 ? `${brandCount} brands, each on its own shelf` : undefined}
        />
        <ViewCard
          href="/?view=all"
          active={view === "all"}
          title="All Products"
          meta={productCount > 0 ? `${productCount} items in one grid` : undefined}
        />
      </div>
    </div>
  );
}

/**
 * One option. These stay links rather than a real `role="radiogroup"`: they genuinely navigate, and
 * a true radiogroup would need roving tabindex + arrow-key handling to not be broken for keyboard
 * users. The dot is decorative and carries the "pick one" meaning visually; `aria-current` carries
 * the same meaning to assistive tech.
 */
function ViewCard({
  href,
  active,
  title,
  meta,
}: {
  href: string;
  active: boolean;
  title: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      // Keep the reader at the catalog section instead of jumping to the top of the page on every
      // switch — the control sits at the section header, so staying put is right.
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={[
        "flex items-start gap-3.5 border px-6 py-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl sm:px-8 sm:py-6",
        active ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line bg-surface",
      ].join(" ")}
    >
      {/* Round on purpose — the circle is what makes this read as a radio, even though the card is square. */}
      <span
        aria-hidden
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-brand-600" : "border-line-strong",
        ].join(" ")}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>

      <span className="min-w-0">
        <span className="block font-[family-name:var(--font-display)] text-xl font-bold text-fg sm:text-2xl">
          {title}
        </span>
        {meta && <span className="mt-1 block text-sm text-muted">{meta}</span>}
      </span>
    </Link>
  );
}
