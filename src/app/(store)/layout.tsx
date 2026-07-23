import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { getBrands } from "@/lib/content";

/**
 * Storefront chrome. Brands are read here (server) and passed into the client header, since the
 * content store touches the filesystem and can't be imported from a client component.
 */
export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header's brand menu. If Firestore is unreachable (e.g. a build with no credentials), fall
  // back to an empty menu rather than failing every page that renders this shared chrome.
  const brands = await getBrands()
    .then((list) => list.map((b) => ({ slug: b.slug, name: b.name })))
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
        <div className="flex min-h-full flex-col">
          <SiteHeader brands={brands} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        <CartDrawer />
      </CartProvider>
    </>
  );
}
