import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { HomeCatalog } from "@/components/home/HomeCatalog";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse everything R&R Newtech Dental carries — imaging, lasers, 3D printing, chairs, " +
    "infection control and everyday consumables. Filter by category, brand or price.",
  alternates: { canonical: "/shop" },
};

/**
 * The catalog's own page. It used to be a section anchored on the home page, which meant the one
 * view customers filter and share had no URL of its own — every filtered result was a fragment on
 * "/". The landing page is now marketing; this is the shop.
 *
 * `HomeCatalog` owns the filter row and validates every param against the admin taxonomy itself,
 * and `CatalogFilters` builds its links from `usePathname()`, so the filters push `/shop?…` here
 * with no route-specific wiring.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    brand?: string;
    min?: string;
    max?: string;
    sort?: string;
  }>;
}) {
  const { category, brand, min, max, sort } = await searchParams;

  // A category has one address: /categories/<slug>. `?category=` was a second URL for the same view
  // — forward it, carrying the other filters, so links already in the wild still land right.
  if (category) {
    const kept = new URLSearchParams(
      Object.entries({ brand, min, max, sort }).filter(([, v]) => v) as [string, string][],
    );
    const qs = kept.toString();
    redirect(`/categories/${category}${qs ? `?${qs}` : ""}`);
  }

  return (
    <>
      <Container className="pt-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">
            Home
          </Link>
        </nav>
      </Container>

      <HomeCatalog category={category} brand={brand} min={min} max={max} sort={sort} />
    </>
  );
}
