"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImg = { src: string; /** contain-on-white (brand logo fallback) vs cover */ contain: boolean };

/**
 * Product-detail image gallery: one large image plus a thumbnail strip that swaps it. Client island
 * so the surrounding detail page stays a server component. Falls back to a single static image when
 * there's only one.
 */
export function BrandProductGallery({ images, alt }: { images: GalleryImg[]; alt: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  return (
    <div>
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

      {images.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active}
                className={[
                  "relative h-16 w-16 overflow-hidden rounded-lg border transition-colors",
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
      )}
    </div>
  );
}
