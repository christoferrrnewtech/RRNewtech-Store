import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SignInPrompt } from "@/components/cart/SignInPrompt";
import { PendingPaymentBanner } from "@/components/checkout/PendingPaymentBanner";
import { getBrands, getCategoriesWithProducts } from "@/lib/content";

/**
 * Storefront chrome. Brands are read here (server) and passed into the client header, since the
 * content store touches the filesystem and can't be imported from a client component.
 *
 * NOTE FOR ANYONE ADDING TO THIS FILE: do not call `cookies()` or `headers()` here. A layout sits
 * in every route's tree, so one dynamic API call opts the ENTIRE storefront out of static
 * generation — ~130 prerendered product and brand pages would each become an origin hit with a
 * Firestore round trip for the menus above. That is precisely why `PendingPaymentBanner` reads its
 * cookie client-side; see `pay-window.ts`.
 */
export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header's brand menu. If Firestore is unreachable (e.g. a build with no credentials), fall
  // back to an empty menu rather than failing every page that renders this shared chrome.
  const brands = await getBrands()
    .then((list) => list.map((b) => ({ slug: b.slug, name: b.name })))
    .catch(() => []);
  // Category mega-menu data (server-only content store → passed into the client header). Filtered
  // to categories that actually have products, so every link in the menu lands somewhere useful.
  const categories = await getCategoriesWithProducts()
    .then((list) =>
      list.map((c) => ({
        slug: c.slug,
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ slug: s.slug, name: s.name })),
      })),
    )
    .catch(() => []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          {/* Above the header, not inside it: SiteHeader is `sticky top-0` and other components
              position against its height (CheckoutClient's summary panel is `lg:sticky lg:top-24`),
              so a strip that appears and disappears mid-session must not change that height. */}
          <PendingPaymentBanner />
          <SiteHeader brands={brands} categories={categories} />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
        </div>
        <CartDrawer />
        <SignInPrompt />
      </CartProvider>
    </>
  );
}
