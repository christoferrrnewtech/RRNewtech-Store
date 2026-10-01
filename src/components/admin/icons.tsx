/**
 * The admin's line icons — one 24×24 stroke path each, drawn at the current text colour.
 *
 * A plain module (no "use client"), so the client sidebar and the server-rendered dashboard can
 * both use it. Exported from AdminNav, a client module, the dashboard would get a client reference
 * instead of the paths.
 */

export const ICONS = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  shop: "M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6",
  storefront: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z",
  orders: "M6 2h12l2 5H4l2-5Zm-2 5v13h16V7M9 11a3 3 0 0 0 6 0",
  inquiries: "M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z",
  banner: "M4 5h16v14H4V5Zm0 10 4-4 3 3 4-5 5 6",
  about: "M5 6h11M5 12h14M5 18h9",
  events: "M4 6h16v14H4V6Zm0 5h16M8 3v4M16 3v4",
  categories: "M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 15h6v4H4v-4Zm10-1h6v6h-6v-6Z",
  brands: "M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11 9v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
} as const;

export type AdminIconName = keyof typeof ICONS;

export function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={ICONS[name]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
