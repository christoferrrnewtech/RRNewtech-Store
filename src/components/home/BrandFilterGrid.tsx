"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { BRAND_GROUPS, BRAND_GROUP_MAP, type BrandGroup } from "@/lib/constants";

/** Plain-serializable card data — built on the server and passed down (content.ts is server-only). */
export type BrandCard = {
  slug: string;
  name: string;
  logo: string;
  tagline: string;
  group: BrandGroup;
  count: number;
};

type Filter = "all" | BrandGroup;

/**
 * Filterable brand grid: a row of category chips over uniform two-zone tiles. The logo sits on a
 * clean light plate (it carries its own background and can't take a text overlay), with the group
 * tag chip above it and the name/tagline/footer below. Filtering is client-side over the passed-in
 * brands, so switching chips never triggers a navigation.
 */
export function BrandFilterGrid({ brands }: { brands: BrandCard[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  // Only offer a chip for groups that actually have brands, so filters never dead-end.
  const present = new Set(brands.map((b) => b.group));
  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All brands" },
    ...BRAND_GROUPS.filter((g) => present.has(g.key)).map((g) => ({ key: g.key, label: g.label })),
  ];

  const visible = filter === "all" ? brands : brands.filter((b) => b.group === filter);

  return (
    <div>
      {chips.length > 2 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                aria-pressed={active}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-fg hover:border-brand-600",
                ].join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((b) => (
          <Link
            key={b.slug}
            href={`/brands/${b.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            {/* Media zone — logo contained on a light plate, tag chip over it. */}
            <div className="relative aspect-[4/3] border-b border-line bg-white">
              <Image
                src={b.logo}
                alt={b.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                className="object-contain p-8 transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="absolute left-3 top-3">
                <Badge tone="brand">{BRAND_GROUP_MAP[b.group].tag}</Badge>
              </span>
            </div>

            {/* Info zone */}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
                {b.name}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{b.tagline}</p>
              <div className="mt-4 flex-1" />
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm font-semibold text-brand-700 group-hover:text-brand-800">
                  Shop {b.name} →
                </span>
                <span className="text-xs text-muted-light">
                  {b.count} product{b.count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
