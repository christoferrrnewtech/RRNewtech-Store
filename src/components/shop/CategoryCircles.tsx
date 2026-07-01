"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { Container } from "@/components/ui/Container";
import { CATEGORIES, type Category } from "@/lib/products";

/**
 * Circular category browser shown directly under the banner. A single horizontal row that
 * scrolls left/right, with blue arrow buttons to scroll. Each circle links to its filtered
 * catalog view (/?category=slug); "All" clears the filter. Placeholder glyph is the category
 * initials until real icon artwork is supplied (Category.icon).
 */
export function CategoryCircles({ activeCategory }: { activeCategory: string }) {
  const scrollerRef = useRef<HTMLUListElement>(null);

  function scrollByDir(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by ~80% of the visible width so a click reveals a fresh set of circles.
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <section aria-label="Shop by category" className="border-b border-line bg-surface">
      <Container className="py-8">
        <h2 className="mb-6 font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          Shop by category
        </h2>

        <div className="flex items-start gap-2 sm:gap-3">
          <ArrowButton dir="left" onClick={() => scrollByDir("left")} />

          <ul
            ref={scrollerRef}
            className="flex flex-1 snap-x gap-4 overflow-x-auto scroll-smooth px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <li className="w-24 shrink-0 snap-start">
              <CircleLink
                href="/"
                label="All"
                glyph="All"
                active={activeCategory === "all"}
              />
            </li>
            {CATEGORIES.map((c) => (
              <li key={c.slug} className="w-24 shrink-0 snap-start">
                <CircleLink
                  href={`/?category=${c.slug}`}
                  label={c.name}
                  glyph={initials(c.name)}
                  icon={c.icon}
                  active={activeCategory === c.slug}
                />
              </li>
            ))}
          </ul>

          <ArrowButton dir="right" onClick={() => scrollByDir("right")} />
        </div>
      </Container>
    </section>
  );
}

/** Blue circular scroll arrow. Sits beside the row (own column) and aligns to the circle center. */
function ArrowButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Scroll categories left" : "Scroll categories right"}
      className={[
        // mt aligns the 36px arrow's center with the 64px circle's center (row has py-2).
        "mt-[1.375rem] flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
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

function CircleLink({
  href,
  label,
  glyph,
  icon,
  active,
}: {
  href: string;
  label: string;
  glyph: string;
  icon?: Category["icon"];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className="group flex flex-col items-center gap-2 text-center"
    >
      <span
        className={[
          "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition-colors",
          active
            ? "bg-brand-600 text-white ring-2 ring-brand-600 ring-offset-2 ring-offset-surface"
            : "bg-brand-50 text-brand-700 group-hover:bg-brand-100",
        ].join(" ")}
      >
        {icon ? (
          <Image src={icon} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
        ) : (
          glyph
        )}
      </span>
      <span className="line-clamp-2 text-xs leading-tight text-muted group-hover:text-fg">
        {label}
      </span>
    </Link>
  );
}

/** First letters of the first two significant words, uppercased (e.g. "Burs & Diamonds" → "BD"). */
function initials(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && w.toLowerCase() !== "and")
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
