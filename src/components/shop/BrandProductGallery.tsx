"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowButton } from "@/components/ui/ArrowButton";

export type GalleryImg = { src: string; /** contain-on-white (brand logo fallback) vs cover */ contain: boolean };

const AUTOPLAY_MS = 5000;

/**
 * Product-detail image gallery: one large image plus a single-row thumbnail strip that swaps it.
 * Client island so the surrounding detail page stays a server component. Falls back to a single
 * static image when there's only one.
 *
 * The main image auto-advances (~5s), pausing on hover/focus and skipping entirely under
 * prefers-reduced-motion — the same contract as the storefront BannerCarousel. Picking a thumbnail
 * stops autoplay for good: continuing to cycle after a deliberate choice is what makes carousels
 * infuriating.
 */
export function BrandProductGallery({ images, alt }: { images: GalleryImg[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const main = images[active] ?? images[0];

  const stripRef = useRef<HTMLUListElement>(null);
  const thumbRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Track scroll position so the arrows disable at each edge. A strip that doesn't overflow simply
  // has both arrows disabled, which keeps the layout stable instead of popping them in on mount.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateEdges, images.length]);

  function scrollByDir(dir: "left" | "right") {
    const el = stripRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  // Autoplay, unless paused (hover/focus), already overridden by a click, or reduced motion.
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => {
    if (paused || userPicked || reduced.current || images.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % images.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, userPicked, images.length]);

  // Keep the highlighted thumbnail in view as autoplay advances. Sets scrollLeft on the strip
  // directly rather than scrollIntoView, which would also scroll the document and yank the page
  // back to the top whenever the gallery advanced while the reader was further down.
  useEffect(() => {
    const el = stripRef.current;
    const thumb = thumbRefs.current[active];
    if (!el || !thumb) return;
    el.scrollTo({
      left: thumb.offsetLeft - (el.clientWidth - thumb.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={[
          "relative aspect-square overflow-hidden rounded-2xl border border-line",
          main.contain ? "bg-white" : "bg-surface",
        ].join(" ")}
      >
        <Image
          src={main.src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 500px"
          className={main.contain ? "object-contain p-12" : "object-cover"}
          priority
        />
      </div>

      {/* Arrows sit beside the strip rather than overlaying it — at 64px a thumbnail is small
          enough that an overlaid arrow would hide half of one. Always rendered so the strip's
          width never shifts; they simply disable at the ends. */}
      {images.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <ArrowButton
            dir="left"
            subject="images"
            disabled={atStart}
            onClick={() => scrollByDir("left")}
          />
          <ul
            ref={stripRef}
            onScroll={updateEdges}
            className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((img, i) => (
              <li
                key={img.src}
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                className="shrink-0 snap-start"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(i);
                    setUserPicked(true);
                  }}
                  aria-label={`View image ${i + 1}`}
                  aria-current={i === active}
                  className={[
                    "relative block h-16 w-16 overflow-hidden rounded-lg border transition-colors",
                    i === active ? "border-brand-500" : "border-line hover:border-line-strong",
                    img.contain ? "bg-white" : "bg-elevated",
                  ].join(" ")}
                >
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="64px"
                    className={img.contain ? "object-contain p-1.5" : "object-cover"}
                  />
                </button>
              </li>
            ))}
          </ul>
          <ArrowButton
            dir="right"
            subject="images"
            disabled={atEnd}
            onClick={() => scrollByDir("right")}
          />
        </div>
      )}
    </div>
  );
}
