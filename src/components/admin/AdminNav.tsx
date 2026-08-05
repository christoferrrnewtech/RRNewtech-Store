"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Count of records still needing attention. Omitted or 0 renders nothing. */
  badge?: number;
};

/** A brand link shown in the collapsible "Brands" group. */
export type AdminBrandLink = { slug: string; name: string; status: "draft" | "published" };

const BRANDS_HREF = "/admin/brands";

const ICONS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z",
  orders: "M6 2h12l2 5H4l2-5Zm-2 5v13h16V7M9 11a3 3 0 0 0 6 0",
  inquiries: "M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z",
  banner: "M4 5h16v14H4V5Zm0 10 4-4 3 3 4-5 5 6",
  about: "M5 6h11M5 12h14M5 18h9",
  categories: "M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 15h6v4H4v-4Zm10-1h6v6h-6v-6Z",
  brands: "M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11 9v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
} as const;

const itemClass = (active: boolean) =>
  [
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-brand-50 text-brand-700 font-semibold"
      : "text-muted hover:bg-elevated hover:text-brand-700",
  ].join(" ");

function NavIcon({ icon }: { icon: keyof typeof ICONS }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={ICONS[icon]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Admin sidebar navigation with an active-route highlight. The role-filtered item list is passed
 * from the server layout, so marketing users still only see the links they're permitted. When a
 * `brands` list is supplied, the "Brands" item becomes a collapsible group listing every brand.
 */
export function AdminNav({
  items,
  brands = [],
}: {
  items: AdminNavItem[];
  brands?: AdminBrandLink[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 lg:flex-col" aria-label="Admin">
      {items.map((item) => {
        if (item.href === BRANDS_HREF && brands.length > 0) {
          return <BrandsNavItem key={item.href} item={item} brands={brands} />;
        }

        // Exact match for the dashboard root; prefix match for the section pages.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            <NavIcon icon={item.icon} />
            {item.label}
            <NavBadge count={item.badge} label={item.label} />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Unread count for a work queue. `ml-auto` pushes it to the rail's right edge; the visually hidden
 * suffix is what makes "Orders 3" read as "Orders, 3 new" to a screen reader.
 */
function NavBadge({ count, label }: { count?: number; label: string }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> new {label.toLowerCase()}</span>
    </span>
  );
}

/**
 * Collapsible "Brands" group: the label navigates to the manage page, the chevron toggles the
 * brand sub-list. Starts open when the current route is already inside /admin/brands (e.g. a deep
 * link to a brand editor), so the active brand is visible without a click.
 */
function BrandsNavItem({ item, brands }: { item: AdminNavItem; brands: AdminBrandLink[] }) {
  const pathname = usePathname();
  const onBrands = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const [open, setOpen] = useState(onBrands);

  return (
    <div>
      <div className={`${itemClass(onBrands)} justify-between gap-1 pr-1`}>
        <Link
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <NavIcon icon={item.icon} />
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Collapse brands" : "Expand brands"}
          className="rounded p-1 text-muted-light hover:text-brand-700"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-line pl-3 lg:ml-4">
          {brands.map((b) => {
            // Prefix match so sub-pages (e.g. /products) keep the brand highlighted.
            const href = `${item.href}/${b.slug}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={b.slug}>
                <Link
                  href={`${item.href}/${b.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-muted hover:bg-elevated hover:text-brand-700",
                  ].join(" ")}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      b.status === "published" ? "bg-success" : "bg-muted-light"
                    }`}
                    title={b.status === "published" ? "Published" : "Draft"}
                  />
                  <span className="truncate">{b.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
