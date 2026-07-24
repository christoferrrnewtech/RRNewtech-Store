"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { reorderBrandsAction } from "@/app/(admin)/admin/actions";

export type RailBrand = {
  slug: string;
  name: string;
  logo: string;
  status: "draft" | "published";
  count: number;
};

/**
 * Left rail for the Brands admin — a prominent "Add a brand" button on top, then the brand list.
 * Selecting a brand navigates to /admin/brands/[slug]; the surrounding layout keeps this rail
 * mounted. Admins can drag / arrow-reorder to set the storefront display order.
 */
export function BrandRail({
  brands,
  canCreate,
  canReorder,
}: {
  brands: RailBrand[];
  canCreate: boolean;
  canReorder: boolean;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState<RailBrand[]>(brands);
  const [, startTransition] = useTransition();

  // Reconcile local order when the server sends a new list (add / delete / reorder).
  const [prev, setPrev] = useState(brands);
  if (brands !== prev) {
    setPrev(brands);
    setItems(brands);
  }

  const onAdd = pathname === "/admin/brands";

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
      {canCreate && (
        <Link
          href="/admin/brands"
          aria-current={onAdd ? "page" : undefined}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            onAdd ? "bg-brand-700 text-white" : "bg-brand-600 text-white hover:bg-brand-700",
          ].join(" ")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Add a brand
        </Link>
      )}

      {items.length > 0 ? (
        <ul className={canCreate ? "mt-3 space-y-2" : "space-y-2"}>
          {items.map((b, i) => (
            <BrandRow
              key={b.slug}
              brand={b}
              index={i}
              total={items.length}
              active={pathname === `/admin/brands/${b.slug}`}
              canReorder={canReorder}
              onMove={move}
              onDrop={drop}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-bg p-4 text-sm text-muted">
          No brands assigned to you yet.
        </p>
      )}
    </div>
  );
}

function BrandRow({
  brand,
  index,
  total,
  active,
  canReorder,
  onMove,
  onDrop,
}: {
  brand: RailBrand;
  index: number;
  total: number;
  active: boolean;
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
      className={[
        "flex items-center gap-2 rounded-xl border bg-surface p-2 transition-colors",
        over ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line",
        active ? "bg-brand-50 ring-1 ring-brand-600" : "hover:border-line-strong",
      ].join(" ")}
    >
      {canReorder && (
        <span className="cursor-grab text-muted-light active:cursor-grabbing" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
      )}

      <Link href={`/admin/brands/${brand.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          <Image src={brand.logo} alt="" fill sizes="40px" className="object-contain p-1" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${published ? "bg-success" : "bg-muted-light"}`}
              title={published ? "Published" : "Draft"}
            />
            <span className="truncate text-sm font-semibold text-fg">{brand.name}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {published ? "Published" : "Draft"} · {brand.count} product{brand.count === 1 ? "" : "s"}
          </span>
        </span>
      </Link>

      {canReorder && (
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(brand.slug, -1)}
            disabled={index === 0}
            aria-label="Move up"
            className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(brand.slug, 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
          >
            ↓
          </button>
        </span>
      )}
    </li>
  );
}
