/**
 * Central site config + copy for the R&R Newtech Dental store.
 * Keep brand/marketing strings here so components stay thin and copy is edited in one place.
 */

// Public site URL — used for canonical links, sitemap, OG. Overridable via env for staging.
// `||` not `??`: an env var present-but-empty (as in .env.example) must still fall back, otherwise
// SITE_URL becomes "" and `new URL(SITE.url)` in the root layout throws on every page.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://rrnewtech.ph"
).replace(/\/$/, "");

export const SITE = {
  name: "R&R Newtech Dental",
  legalName: "R&R Newtech Dental Corporation",
  domain: "rrnewtech.ph",
  url: SITE_URL,
  tagline: "Trusted dental supplies, delivered across the Philippines.",
  description:
    "R&R Newtech Dental Corporation is your online source for quality dental supplies, equipment, and consumables — competitive prices, fast nationwide delivery, and GCash, Maya & card payments.",
  email: "sales@rrnewtech.ph",
  phone: "+63 (2) 8000 0000",
  supportLine: "PH-based support — Mon–Sat, Philippine time",
  socials: {
    facebook: "https://facebook.com/rrnewtechdental",
    instagram: "https://instagram.com/rrnewtechdental",
    linkedin: "https://linkedin.com/company/rrnewtechdental",
  },
} as const;

/** Free-shipping threshold shown in the promo bar and cart (display-only in Phase 1). */
export const FREE_SHIPPING_THRESHOLD = 3000;

/**
 * Brand grouping — drives the category tag chip on each brand card and the filter chips in the
 * "Shop by Brand" section. Client-safe (no fs), so both the client grid and content.ts import it.
 * `label` is the filter-chip text; `tag` is the shorter badge shown on the card.
 */
export type BrandGroup = "equipment" | "consumables" | "laser-whitening";

export const BRAND_GROUPS: { key: BrandGroup; label: string; tag: string }[] = [
  { key: "equipment", label: "Equipment & Devices", tag: "Equipment" },
  { key: "consumables", label: "Consumables & Materials", tag: "Consumables" },
  { key: "laser-whitening", label: "Laser & Whitening", tag: "Laser & Whitening" },
];

export const BRAND_GROUP_MAP: Record<BrandGroup, { label: string; tag: string }> =
  Object.fromEntries(BRAND_GROUPS.map((g) => [g.key, { label: g.label, tag: g.tag }])) as Record<
    BrandGroup,
    { label: string; tag: string }
  >;

/**
 * Temporary visibility switches for the soft launch — the landing page is cut back to
 * banner → Our Brands → Digital Dentistry while the catalog is still being built out.
 * Flip a flag to true to bring that section back; the components themselves are untouched.
 */
export const SECTIONS = {
  categoryCircles: false, // "Shop by category" row under the banner
  categoryNav: true, // "Categories" mega-menu in the header (desktop + mobile)
  allProducts: false, // "All Products" catalog on the *unfiltered* landing view
} as const;

/**
 * Primary top-nav links (plain links). "Categories" and "Brand" are mega-menu triggers handled
 * in SiteHeader, not listed here. The logo already links home, so there's no separate "Shop" link.
 */
export const NAV_LINKS = [
  { href: "/about", label: "About" },
] as const;

/** Trust badges shown on the home page and footer. */
export const TRUST_POINTS = [
  {
    title: "Authentic products",
    body: "Sourced from trusted manufacturers and authorized distributors.",
  },
  {
    title: "Nationwide delivery",
    body: "Fast, tracked shipping to clinics and homes across the Philippines.",
  },
  {
    title: "Pay how you want",
    body: "GCash, Maya, cards, and bank transfer — secure checkout (coming soon).",
  },
  {
    title: "Bulk & clinic pricing",
    body: "Better rates on volume orders for dental practices. Ask our team.",
  },
] as const;

export const FAQS = [
  {
    q: "What products does R&R Newtech Dental sell?",
    a: "We carry dental consumables, instruments, equipment, infection control, and orthodontic supplies — everything a clinic or dental professional needs, plus everyday oral-care essentials for the home.",
  },
  {
    q: "How do I place an order?",
    a: "Browse the shop, add items to your cart, and review them anytime. Online checkout with GCash, Maya, and card payment is rolling out soon; in the meantime you can send your cart as an inquiry and our team will confirm stock and delivery.",
  },
  {
    q: "Do you deliver nationwide?",
    a: "Yes. We ship to clinics and homes across the Philippines via trusted couriers, with tracking on every order.",
  },
  {
    q: "Do you offer bulk or clinic pricing?",
    a: "We do. Dental practices ordering in volume get better rates — contact our sales team for a quotation.",
  },
  {
    q: "What payment methods will be accepted?",
    a: "GCash, Maya, major cards, and bank transfer via a secure Philippine payment gateway. This is being finalized now.",
  },
  {
    q: "How can I reach your team?",
    a: "Email sales@rrnewtech.ph or use the Contact page. We reply Monday to Saturday, Philippine time.",
  },
] as const;
