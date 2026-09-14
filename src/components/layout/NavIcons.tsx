import type { NavIconKey } from "@/lib/constants";

/**
 * The site's line-icon set. Named for its first caller, but the trust strip and the Education &
 * Training page draw from it too — add new glyphs here rather than inlining one-offs. Hand-rolled to
 * match the SVGs already inline in SiteHeader/SearchBar/CartButton; the repo carries no icon library
 * and adding one for a dozen glyphs isn't worth the bundle.
 *
 * All share the same 24-box, 1.7 stroke and inherit `currentColor`, so a parent's text color
 * drives them. The 18px default is overridable with a `h-*`/`w-*` class.
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
  shop: (p) => (
    <Svg {...p}>
      <path d="M4.2 8.4h15.6l-1.2 11a1.8 1.8 0 0 1-1.8 1.6H7.2a1.8 1.8 0 0 1-1.8-1.6l-1.2-11Z" />
      <path d="M8.8 8.4V6.6a3.2 3.2 0 0 1 6.4 0v1.8" />
    </Svg>
  ),
  shield: (p) => (
    <Svg {...p}>
      <path d="M12 3.2 5.2 6v5.4c0 4.2 2.8 7.6 6.8 9.4 4-1.8 6.8-5.2 6.8-9.4V6L12 3.2Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </Svg>
  ),
  truck: (p) => (
    <Svg {...p}>
      <path d="M3.2 6.6h10.2v9.6H3.2z" />
      <path d="M13.4 10.2h3.8l3.6 3.2v2.8h-7.4z" />
      <circle cx="7.4" cy="18" r="1.9" />
      <circle cx="16.8" cy="18" r="1.9" />
    </Svg>
  ),
  wrench: (p) => (
    <Svg {...p}>
      <path d="M14.9 3.4a5.2 5.2 0 0 0-4.6 7.6L3.9 17.4a2 2 0 0 0 2.8 2.8l6.4-6.4a5.2 5.2 0 0 0 6.5-6.9l-2.9 2.9-2.6-.7-.7-2.6 2.9-2.9a5.2 5.2 0 0 0-1.4-.2Z" />
    </Svg>
  ),
  graduation: (p) => (
    <Svg {...p}>
      <path d="M12 4.2 2.8 8.6 12 13l9.2-4.4L12 4.2Z" />
      <path d="M6.6 10.6v4.9c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.9" />
      <path d="M21.2 8.6v5.1" />
    </Svg>
  ),
  users: (p) => (
    <Svg {...p}>
      <circle cx="9.2" cy="8.4" r="3.2" />
      <path d="M3 19.4c0-3.1 2.8-5.2 6.2-5.2s6.2 2.1 6.2 5.2" />
      <path d="M16.4 5.6a3.2 3.2 0 0 1 0 5.7M17.6 14.7c2 .7 3.4 2.4 3.4 4.5" />
    </Svg>
  ),
  building: (p) => (
    <Svg {...p}>
      <path d="M4.4 20.6V6.2L12 3.4l7.6 2.8v14.4" />
      <path d="M2.8 20.6h18.4" />
      <path d="M9.2 20.6v-4.4h5.6v4.4" />
      <path d="M9.4 9.2h1.2M13.4 9.2h1.2M9.4 12.6h1.2M13.4 12.6h1.2" />
    </Svg>
  ),
  check: (p) => (
    <Svg {...p}>
      <path d="m4.8 12.4 4.8 4.8L19.2 7.2" />
    </Svg>
  ),
  pin: (p) => (
    <Svg {...p}>
      <path d="M12 21.4c4.2-4.6 6.3-8 6.3-10.5a6.3 6.3 0 1 0-12.6 0c0 2.5 2.1 5.9 6.3 10.5Z" />
      <circle cx="12" cy="10.6" r="2.4" />
    </Svg>
  ),
};
