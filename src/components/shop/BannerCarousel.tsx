"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { HeroSlide } from "@/components/home/HeroSlide";
import type { Banner } from "@/lib/content";

const AUTOPLAY_MS = 5000;

/**
 * Storefront hero carousel: auto-advances (~5s), pauses on hover, and skips autoplay under
 * prefers-reduced-motion. Manual control is the row of bars at bottom-left — no arrows, since each
 * slide's own CTAs are the thing to click and floating arrows fought them for attention. Slides
 * share a min-height so differing image sizes don't shift the layout. Rendered only for 2+ banners;
 * StoreHero handles the 0/1 cases.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  // Autoplay, unless paused (hover/focus) or the user prefers reduced motion.
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="relative w-full overflow-hidden bg-brand-900"
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

      {/* Indicators — bars, aligned with the copy above them rather than centered. */}
      <Container className="pointer-events-none absolute inset-x-0 bottom-8">
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
                i === index ? "bg-white" : "bg-white/35 hover:bg-white/60",
              ].join(" ")}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
