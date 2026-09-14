import Link from "next/link";

/**
 * The body of a header dropdown: one plain link per row.
 *
 * Shared by {@link CategoryMenu} and {@link BrandMenu}, which now differ only in how they build an
 * href. Used by the desktop dropdown panel and by the mobile drawer's accordions, so it carries no
 * positioning or panel chrome of its own — the caller owns that.
 */
export function MenuList({
  items,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className="block whitespace-nowrap px-5 py-2.5 text-sm text-fg hover:bg-elevated hover:text-brand-700"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
