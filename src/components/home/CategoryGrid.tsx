import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getCategoriesWithCounts, type CategoryWithCount } from "@/lib/content";

/**
 * Tiles shown before the grid stops. Six fills two clean rows of three at `lg`.
 *
 * Exported because the admin's "Shop by category" panel draws the same cut-off line: it has to
 * show which categories actually reach the landing page, and a second copy of this number would
 * quietly start lying the first time one of them changed.
 */
export const HOME_CATEGORY_LIMIT = 6;

/**
 * "Shop by category" — photo tiles into the biggest stocked categories.
 *
 * Counts come from {@link getCategoriesWithCounts}, which drops empty categories, so every tile
 * here lands somewhere with products in it. Renders nothing at all if nothing is stocked yet.
 */
export async function CategoryGrid() {
  const categories = await getCategoriesWithCounts().catch(() => []);
  if (categories.length === 0) return null;

  return (
    <section className="bg-bg py-14 lg:py-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl">
            Shop by category
          </h2>
          {/* There's no /categories index — the filterable catalog is the "everything" view. */}
          <Link href="/shop" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            Browse all products &rarr;
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, HOME_CATEGORY_LIMIT).map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function CategoryCard({ category }: { category: CategoryWithCount }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group relative flex aspect-[16/10] items-end overflow-hidden rounded-2xl bg-brand-800"
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        // No photo uploaded yet. A brand-blue field is a deliberate-looking tile rather than a
        // visibly missing image, so the section can ship before the photography does.
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900" />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-brand-900/92 via-brand-900/45 to-brand-900/10"
      />

      <div className="relative p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight text-white">
          {category.name}
        </h3>
        <p className="mt-1 text-sm text-white/70">
          {category.count} product{category.count === 1 ? "" : "s"}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          Browse
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            &rarr;
          </span>
        </span>
      </div>
    </Link>
  );
}
