"use client";

import Image from "next/image";
import Link from "next/link";

/** Minimal serializable shape — logos only (name is for alt/aria, never shown). */
export type BrandLogo = { slug: string; name: string; logo: string };

/**
 * Logo-only brand marquee for the home "Shop by Brand" section. A single track holds the logo set
 * duplicated once and auto-scrolls left (see `.marquee` / `@keyframes marquee` in globals.css),
 * pausing on hover and falling back to a static, horizontally-scrollable row under
 * prefers-reduced-motion. Each logo sits contained on a white plate (logos carry their own
 * backgrounds) and links to its brand page.
 */
export function BrandLogoCarousel({ brands }: { brands: BrandLogo[] }) {
  if (brands.length === 0) return null;
  const loop = [...brands, ...brands];

  return (
    <div className="marquee relative overflow-hidden" aria-label="Our brands">
      {/* Edge fades so logos slide in/out softly rather than clipping at the container edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg to-transparent sm:w-16"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg to-transparent sm:w-16"
      />

      <ul className="marquee-track flex w-max items-center gap-6">
        {loop.map((b, i) => {
          const isClone = i >= brands.length;
          return (
            <li key={`${b.slug}-${i}`} className="shrink-0">
              <Link
                href={`/brands/${b.slug}`}
                aria-label={b.name}
                aria-hidden={isClone}
                tabIndex={isClone ? -1 : 0}
                className="relative flex h-20 w-36 items-center justify-center transition-transform duration-200 hover:-translate-y-1 sm:h-24 sm:w-44"
              >
                <Image
                  src={b.logo}
                  alt={b.name}
                  fill
                  sizes="176px"
                  className="object-contain p-2"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
