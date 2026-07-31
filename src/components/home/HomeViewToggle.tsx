import Link from "next/link";
import type { HomeView } from "@/components/home/HomeCatalog";

const OPTIONS: { view: HomeView; label: string }[] = [
  { view: "by-brand", label: "By Brand" },
  { view: "all", label: "All Products" },
];

/**
 * Segmented control that switches the homepage catalog between the grouped brand shelves
 * ("By Brand") and the flat marketplace grid ("All Products"). State lives in the `?view=` URL
 * param — server-rendered and shareable — matching how category/brand/sort/search already work.
 */
export function HomeViewToggle({ view }: { view: HomeView }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Catalog view">
      {OPTIONS.map((opt) => {
        const active = opt.view === view;
        return (
          <Link
            key={opt.view}
            href={opt.view === "by-brand" ? "/" : "/?view=all"}
            aria-current={active ? "true" : undefined}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              active ? "bg-brand-600 text-white" : "text-muted hover:text-fg",
            ].join(" ")}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
