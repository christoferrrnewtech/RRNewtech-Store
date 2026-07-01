# R&R Newtech Dental — Online Store

E-commerce storefront for **R&R Newtech Dental Corporation** — a B2C dental-supply shop for the
Philippines (consumables, instruments, equipment, infection control, orthodontics, oral care).

Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**, server-rendered for SEO,
with SEO and ad tracking wired in from day one. This is **Phase 1: storefront + cart** — browse,
filter, product pages, and a fully working client-side cart. Online payment and the admin panel
come in later phases (see the project plan).

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — the site runs fine with everything empty
npm run dev                  # http://localhost:3000
```

```bash
npm run build   # production build (SSG/ISR) — works with NO credentials
npm run start   # serve the production build
npm run lint    # eslint
```

The site **builds and runs with no environment variables**: the catalog is seeded in code and all
analytics no-op cleanly until IDs are set.

## What's in Phase 1

- **Home** — hero, category grid, featured products, bulk-pricing CTA.
- **Shop** (`/shop`) — server-rendered listing with category filter + sort via URL params
  (indexable, ad-landing friendly).
- **Product pages** (`/products/[slug]`) — pre-rendered for every product, with `Product` JSON-LD,
  quantity selector, related products, and per-page metadata/OG.
- **Cart** — client-side, persisted to `localStorage`; slide-over drawer + full `/cart` page.
  Checkout is a Phase-2 "send as inquiry" placeholder (composes an email) until PayMongo is wired.
- **Content pages** — About, Contact, FAQ (with FAQ schema), Shipping & Returns, Privacy, Terms.
- **SEO** — dynamic `sitemap.ts` (all products + categories), `robots.ts`, canonical URLs,
  Organization/WebSite + Product JSON-LD, and a branded `opengraph-image`.
- **Analytics/ads** — Meta Pixel + GA4 loaders (keyless-safe) firing `view_item` and `add_to_cart`
  from a single `src/lib/analytics.ts`.

## Configure (optional in Phase 1)

Set in `.env.local` before running paid traffic:

- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel (PageView + ecommerce events)
- `NEXT_PUBLIC_GA_ID` — GA4 measurement ID (`G-XXXXXXXXXX`)
- `NEXT_PUBLIC_SITE_URL` — canonical/sitemap/OG base URL (defaults to `https://rrnewtech.ph`)

## Project structure

```
src/
  app/
    layout.tsx              fonts, SEO metadata, CartProvider, header/footer/drawer, analytics
    page.tsx                home
    shop/page.tsx           server-rendered catalog (filter + sort)
    products/[slug]/page.tsx  product detail (generateStaticParams + generateMetadata)
    cart/page.tsx           full cart page
    contact/                contact page + mailto form
    about, faq, shipping-returns, privacy, terms
    sitemap.ts, robots.ts, opengraph-image.tsx, icon.svg
  components/
    layout/                 SiteHeader, SiteFooter
    cart/                   CartButton, CartDrawer
    shop/                   ProductCard, AddToCartButton, ShopControls
    product/                ProductPurchase
    analytics/              MetaPixel, GoogleAnalytics, StructuredData, ProductJsonLd
    ui/                     Button, Container, Badge
  lib/
    products.ts             data model + seed catalog + query helpers (swap to DB in Phase 4)
    cart.tsx                cart context (localStorage)
    analytics.ts            single place for Pixel + GA4 events
    constants.ts            site config + copy
    format.ts               peso formatting
```

## Roadmap (next phases)

- **Phase 2 — Checkout & payments:** PayMongo (GCash, Maya, card) via API routes + webhook,
  orders + confirmation email (Resend), `begin_checkout`/`purchase` conversion events.
- **Phase 3 — Accounts:** customer login, order history.
- **Phase 4 — Admin panel:** staff dashboard for products/stock/orders; move catalog to a DB
  behind the existing `src/lib/products.ts` helper interface.
