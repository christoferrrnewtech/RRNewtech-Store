"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/lib/content";

const AUTOPLAY_MS = 5000;

/**
 * Storefront banner carousel: auto-advances (~5s), pauses on hover, and skips autoplay under
 * prefers-reduced-motion. Arrows + dots for manual control. Slides share a fixed aspect box so
 * differing image sizes don't shift the layout. Rendered only for 2+ banners — ShopBanner handles
 * the 0/1 cases.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const go = useCallback((n: number) => setIndex((n + count) % count), [count]);

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
      className="relative w-full overflow-hidden bg-elevated"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative aspect-[1489/551]">
        {banners.map((b, i) => {
          const img = (
            <Image
              src={b.image}
              alt={b.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          );
          return (
            <div
              key={b.id}
              aria-hidden={i !== index}
              className={[
                "absolute inset-0 transition-opacity duration-700",
                i === index ? "opacity-100" : "pointer-events-none opacity-0",
              ].join(" ")}
            >
              {b.href ? (
                <Link href={b.href} tabIndex={i === index ? 0 : -1} className="block h-full w-full">
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous banner"
        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-700 shadow-md backdrop-blur transition hover:bg-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next banner"
        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-700 shadow-md backdrop-blur transition hover:bg-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to banner ${i + 1}`}
            aria-current={i === index}
            className={[
              "h-2 rounded-full transition-all",
              i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  );
}
