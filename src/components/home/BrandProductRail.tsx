"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { BrandProductCard } from "@/components/shop/BrandProductCard";
import { LinkButton } from "@/components/ui/Button";
import type { BrandProduct } from "@/lib/content";

/**
 * One brand's "shelf" on the homepage By-Brand view: a feature panel (brand logo + name + tagline
 * + "View all →") beside a horizontally scrollable rail of the brand's product cards. Composes the
 * DigitalDentistryPromo panel idea with the CategoryCircles arrow-scroller so it looks native.
 * The brand logo (which carries its own colour) is the visual anchor; R&R blue stays the accent.
 */
export function BrandProductRail({
  brand,
  products,
}: {
  brand: { slug: string; name: string; logo: string; tagline?: string };
  products: BrandProduct[];
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const brandHref = `/brands/${brand.slug}`;

  function scrollByDir(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by ~80% of the visible width so a click reveals a fresh set of cards.
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div className="border-2 border-brand-600 bg-surface p-3 sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* Feature panel */}
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <Link
            href={brandHref}
            className="relative mb-4 block aspect-[16/9] w-full overflow-hidden rounded-xl bg-white"
          >
            <Image
              src={brand.logo}
              alt={brand.name}
              fill
              sizes="256px"
              className="object-contain p-5"
            />
          </Link>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            <Link href={brandHref} className="hover:text-brand-700">
              {brand.name}
            </Link>
          </h3>
          {brand.tagline && (
            <p className="mt-1 line-clamp-3 text-sm text-muted">{brand.tagline}</p>
          )}
          <LinkButton
            href={brandHref}
            variant="primary"
            size="sm"
            className="mt-5 w-fit whitespace-nowrap"
          >
            Shop {brand.name} →
          </LinkButton>
        </div>

        {/* Product rail */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ArrowButton dir="left" onClick={() => scrollByDir("left")} />
          <ul
            ref={scrollerRef}
            className="flex min-w-0 flex-1 snap-x gap-4 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {products.map((product) => (
              <li key={product.id} className="w-[14rem] shrink-0 snap-start sm:w-[15rem]">
                <BrandProductCard
                  product={product}
                  brandName={brand.name}
                  brandSlug={brand.slug}
                  brandLogo={brand.logo}
                />
              </li>
            ))}
          </ul>
          <ArrowButton dir="right" onClick={() => scrollByDir("right")} />
        </div>
      </div>
    </div>
  );
}

/** Blue circular scroll arrow — hidden on phones where touch/swipe is primary. */
function ArrowButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Scroll products left" : "Scroll products right"}
      className={[
        "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex",
        "bg-brand-600 text-white shadow-md transition-colors hover:bg-brand-700",
      ].join(" ")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
