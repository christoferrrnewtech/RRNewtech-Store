import type { NavIconKey } from "@/lib/constants";

/**
 * Line icons for the header nav strip. Hand-rolled to match the SVGs already inline in
 * SiteHeader/SearchBar/CartButton — the repo carries no icon library and adding one for eight
 * glyphs isn't worth the bundle.
 *
 * All share the same 24-box, 1.7 stroke and inherit `currentColor`, so a parent's text color
 * drives them.
 */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const NAV_ICONS: Record<NavIconKey, (props: IconProps) => React.ReactElement> = {
  category: (p) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </Svg>
  ),
  about: (p) => (
    <Svg {...p}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3 20c0-3.1 2.9-5.2 6.5-5.2s6.5 2.1 6.5 5.2" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9M18 14.9c2 .8 3.3 2.5 3.3 4.6" />
    </Svg>
  ),
  brand: (p) => (
    <Svg {...p}>
      <path d="M11.4 3.2H19a1.8 1.8 0 0 1 1.8 1.8v7.6a1.8 1.8 0 0 1-.53 1.27l-6.6 6.6a1.8 1.8 0 0 1-2.55 0l-7.6-7.6a1.8 1.8 0 0 1 0-2.55l6.6-6.6a1.8 1.8 0 0 1 1.27-.53Z" />
      <circle cx="16.2" cy="7.8" r="1.3" />
    </Svg>
  ),
  events: (p) => (
    <Svg {...p}>
      <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2" />
      <path d="M3.4 10h17.2M8.4 3.4v3.6M15.6 3.4v3.6" />
      <path d="M7.8 14h2M12 14h2M16.2 14h.01M7.8 17.4h2M12 17.4h2" />
    </Svg>
  ),
  contact: (p) => (
    <Svg {...p}>
      <path d="M20.6 12.6c0 3.9-3.85 7.1-8.6 7.1a10 10 0 0 1-2.5-.31L4.6 20.9l1.3-3.7a6.6 6.6 0 0 1-2.5-4.6c0-3.9 3.85-7.1 8.6-7.1s8.6 3.2 8.6 7.1Z" />
    </Svg>
  ),
};
