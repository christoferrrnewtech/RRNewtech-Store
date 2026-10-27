"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { HeroSlide } from "@/components/home/HeroSlide";
import type { Banner } from "@/lib/content";

const AUTOPLAY_MS = 5000;

/**
 * Storefront hero carousel: auto-advances (~5s), pauses on hover, and skips autoplay under
 * prefers-reduced-motion. Manual control is the row of bars at bottom-left plus prev/next arrows on
 * the slide edges. With a mouse the arrows only appear while the carousel is hovered, so they don't
 * compete with each slide's own CTAs; on touch screens (no hover) they're always shown. Slides
 * stack in one grid cell, so the section takes the tallest slide's height and doesn't jump between
 * slides. Rendered only for 2+ banners;
 * StoreHero handles the 0/1 cases.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;
  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  // Autoplay, unless paused (hover/focus) or the user prefers reduced motion. Keyed on `index` too,
  // so a manual change gives the new slide its full interval instead of flipping away early.
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count, index]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="group @container relative w-full overflow-hidden bg-brand-50"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* All slides occupy the same single grid cell, so they stack and the section takes the
          height of the tallest one. A fixed aspect box used to clip whichever slide had the most
          copy, and absolute positioning would hide that overflow instead of accommodating it.
          `inert` on the inactive slides keeps their CTAs out of the tab order. */}
      <div className="grid">
        {banners.map((b, i) => (
          <div
            key={b.id}
            aria-hidden={i !== index}
            inert={i !== index}
            className={[
              "col-start-1 row-start-1 transition-opacity duration-700",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            <HeroSlide banner={b} priority={i === 0} headingLevel={i === 0 ? "h1" : "h2"} />
          </div>
        ))}
      </div>

      {/* Prev/next arrows, vertically centered on the slide edges and sized with the slide. */}
      <ArrowButton direction="prev" onClick={prev} />
      <ArrowButton direction="next" onClick={next} />

      {/* Indicators — bars, aligned with the copy above them rather than centered. The offset
          scales with the slide like its copy does, so it stays inside the copy's bottom padding
          instead of landing on the buttons of a phone-sized slide. */}
      <Container className="pointer-events-none absolute inset-x-0 bottom-[clamp(6px,2.222cqw,32px)]">
        <div className="pointer-events-auto flex gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to banner ${i + 1}`}
              aria-current={i === index}
              className={[
                "h-1 w-8 transition-colors",
                i === index ? "bg-brand-600" : "bg-brand-600/30 hover:bg-brand-600/60",
              ].join(" ")}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous banner" : "Next banner"}
      className={[
        "absolute top-1/2 grid size-[clamp(24px,2.778cqw,44px)] -translate-y-1/2 place-items-center rounded-full bg-white/80 text-brand-600 shadow-sm transition hover:bg-white",
        "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100",
        direction === "prev"
          ? "left-[clamp(4px,1.111cqw,16px)]"
          : "right-[clamp(4px,1.111cqw,16px)]",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={["size-[60%]", direction === "next" ? "rotate-180" : ""].join(" ")}
      >
        <path
          fillRule="evenodd"
          d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
