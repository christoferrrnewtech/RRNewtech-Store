/**
 * Shared, non-client module so both the server page (section chips) and the client BrandEditor can
 * import this list. A "use client" module can't export a plain array to a server component —
 * Next.js replaces it with a client reference proxy.
 */

/** Anchor targets for the sticky section-jump chips — kept in sync with the sections in BrandEditor. */
export const BRAND_EDITOR_SECTIONS = [
  { id: "sec-visibility", label: "Visibility" },
  { id: "sec-hero", label: "Hero banner" },
  { id: "sec-logo", label: "Brand logo" },
  { id: "sec-about", label: "About" },
  { id: "sec-video", label: "Video" },
  { id: "sec-gallery", label: "Gallery" },
  { id: "sec-products", label: "Products" },
  { id: "sec-reasons", label: "Why choose" },
  { id: "sec-cta", label: "Contact / demo" },
] as const;
