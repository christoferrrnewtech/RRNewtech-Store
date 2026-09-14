import { MenuList } from "@/components/layout/MenuList";

/** Slug + name only — the minimum the menu needs, passed down from the store layout. */
export type BrandLink = { slug: string; name: string };

/**
 * The Brands dropdown: every published brand, each linking to its brand page. Presentational — the
 * header owns open/close state and the panel chrome, and the store layout supplies the brands (the
 * content store is server-only).
 */
export function BrandMenu({
  brands,
  onNavigate,
}: {
  brands: BrandLink[];
  onNavigate?: () => void;
}) {
  return (
    <MenuList
      items={brands.map((b) => ({ href: `/brands/${b.slug}`, label: b.name }))}
      onNavigate={onNavigate}
    />
  );
}
