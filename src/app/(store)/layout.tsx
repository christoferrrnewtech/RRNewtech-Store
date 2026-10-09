import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TopUtilityBar } from "@/components/layout/TopUtilityBar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SignInPrompt } from "@/components/cart/SignInPrompt";
import { PendingPaymentBanner } from "@/components/checkout/PendingPaymentBanner";
import { getBrands, getCategoriesWithProducts } from "@/lib/content";
import { SECTIONS } from "@/lib/constants";

/**
 * Storefront chrome. Brands are read here (server) and passed into the client header, since the
 * content store touches the filesystem and can't be imported from a client component.
 *
 * Every storefront page renders fresh from Firestore on each request — nothing is prerendered at
 * build or cached between visits. Caching was tried and dropped: on App Hosting, `revalidatePath()`
 * after an admin save only clears the one instance that handled it, so other (and cold-started)
 * instances kept serving pages with old product images; even time-based `revalidate` hands the
 * first visitor after expiry the stale copy. Fresh renders are the only way a first-time visitor
 * is guaranteed the current images. The menus' Firestore reads are request-cached (`cache()`), so
 * a page costs a handful of document reads.
 */
export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header's brand menu. If Firestore is unreachable (e.g. a build with no credentials), fall
  // back to an empty menu rather than failing every page that renders this shared chrome.
  const brandList = await getBrands().catch(() => []);
  const brands = brandList.map((b) => ({ slug: b.slug, name: b.name }));
  // Catalog size for the search placeholder. Free: `getBrands()` is request-cached and each brand
  // doc already carries its full product array.
  const productCount = brandList.reduce((n, b) => n + b.products.length, 0);
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
              position against its height — 64px on mobile, 128px at `lg` where the icon nav strip
              shows (CheckoutClient's summary panel is `lg:sticky lg:top-36`, anchors are
              `scroll-mt-24 lg:scroll-mt-36`) — so a strip that appears and disappears mid-session
              must not change that height. */}
          <PendingPaymentBanner />
          {SECTIONS.utilityBar && <TopUtilityBar />}
          <SiteHeader brands={brands} categories={categories} productCount={productCount} />
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
