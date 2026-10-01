"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { reorderBrandsAction } from "@/app/(admin)/admin/actions";
import { StatusPill } from "@/components/admin/StatusPill";

export type RailBrand = {
  slug: string;
  name: string;
  logo: string;
  status: "draft" | "published";
  count: number;
};

/**
 * The brand list on /admin/brands, in storefront order. Each row opens the brand's editor; admins
 * can drag or arrow-reorder to set the order shoppers see.
 */
export function BrandRail({
  brands,
  canReorder,
}: {
  brands: RailBrand[];
  canReorder: boolean;
}) {
  const [items, setItems] = useState<RailBrand[]>(brands);
  const [, startTransition] = useTransition();

  // Reconcile local order when the server sends a new list (add / delete / reorder).
  const [prev, setPrev] = useState(brands);
  if (brands !== prev) {
    setPrev(brands);
    setItems(brands);
  }

  function commitOrder(next: RailBrand[]) {
    setItems(next);
    startTransition(() => reorderBrandsAction(next.map((b) => b.slug)));
  }

  function move(slug: string, dir: -1 | 1) {
    const i = items.findIndex((b) => b.slug === slug);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  }

  function drop(dragSlug: string, targetSlug: string) {
    if (dragSlug === targetSlug) return;
    const from = items.findIndex((b) => b.slug === dragSlug);
    const to = items.findIndex((b) => b.slug === targetSlug);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOrder(next);
  }

  return (
    <div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((b, i) => (
            <BrandRow
              key={b.slug}
              brand={b}
              index={i}
              total={items.length}
              canReorder={canReorder}
              onMove={move}
              onDrop={drop}
            />
          ))}
        </ul>
      ) : (
        <p className="px-6 py-10 text-center text-sm text-muted">
          No brands assigned to you yet. Ask an admin to give you access.
        </p>
      )}
    </div>
  );
}

function BrandRow({
  brand,
  index,
  total,
  canReorder,
  onMove,
  onDrop,
}: {
  brand: RailBrand;
  index: number;
  total: number;
  canReorder: boolean;
  onMove: (slug: string, dir: -1 | 1) => void;
  onDrop: (dragSlug: string, targetSlug: string) => void;
}) {
  const [over, setOver] = useState(false);
  const published = brand.status === "published";

  return (
    <li
      draggable={canReorder}
      onDragStart={
        canReorder ? (e) => e.dataTransfer.setData("text/plain", brand.slug) : undefined
      }
      onDragOver={
        canReorder
          ? (e) => {
              e.preventDefault();
              setOver(true);
            }
          : undefined
      }
      onDragLeave={canReorder ? () => setOver(false) : undefined}
      onDrop={
        canReorder
          ? (e) => {
              e.preventDefault();
              setOver(false);
              onDrop(e.dataTransfer.getData("text/plain"), brand.slug);
            }
          : undefined
      }
      className={`group flex items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${
        over ? "bg-brand-50 ring-2 ring-inset ring-brand-500/40" : "hover:bg-elevated/60"
      }`}
    >
      {canReorder && (
        <span
          className="hidden cursor-grab text-muted-light active:cursor-grabbing sm:block"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
      )}
      <span className="hidden w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-light sm:block">
        {index + 1}
      </span>

      <Link href={`/admin/brands/${brand.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          {brand.logo && (
            <Image src={brand.logo} alt="" fill sizes="64px" className="object-contain p-1.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-fg group-hover:text-brand-700">
            {brand.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {brand.count} product{brand.count === 1 ? "" : "s"}
          </span>
        </span>
      </Link>

      <StatusPill status={brand.status} />

      <div className="hidden items-center gap-1 md:flex">
        <Link
          href={`/admin/brands/${brand.slug}`}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          Edit
        </Link>
        {published && (
          <Link
            href={`/brands/${brand.slug}`}
            target="_blank"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-elevated hover:text-fg"
          >
            View ↗
          </Link>
        )}
      </div>

      {canReorder && (
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(brand.slug, -1)}
            disabled={index === 0}
            aria-label={`Move ${brand.name} up`}
            className="rounded px-1.5 text-muted hover:bg-elevated hover:text-brand-700 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(brand.slug, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${brand.name} down`}
            className="rounded px-1.5 text-muted hover:bg-elevated hover:text-brand-700 disabled:opacity-30"
          >
            ↓
          </button>
        </span>
      )}
    </li>
  );
}
