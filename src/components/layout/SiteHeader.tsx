"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/cart/CartButton";
import { LinkButton } from "@/components/ui/Button";
import { AccountLink } from "@/components/layout/AccountLink";
import { SearchBar } from "@/components/layout/SearchBar";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { CategoryMenu, type MenuCategory } from "@/components/layout/CategoryMenu";
import { BrandMenu, type BrandLink } from "@/components/layout/BrandMenu";
import { NAV_ITEMS, SECTIONS, SITE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatPHP } from "@/lib/format";

type MenuKey = "category" | "brand";

export function SiteHeader({
  brands,
  categories,
  productCount,
}: {
  brands: BrandLink[];
  categories: MenuCategory[];
  /** Catalog size for the search placeholder — counted in the layout, which already has the brands. */
  productCount?: number;
}) {
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MenuKey | null>(null);

  const pathname = usePathname();

  const closeAll = () => {
    setActiveMenu(null);
    setMobileOpen(false);
    setMobileSection(null);
  };

  // Close on route change. Query-only changes (category/brand clicks) close via each link's
  // onNavigate={closeAll}, so we only need to react to pathname here.
  useEffect(() => {
    closeAll();
  }, [pathname]);

  // Esc closes menus.
  useEffect(() => {
    if (!activeMenu && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMenu, mobileOpen]);

  // The Categories menu opens an empty panel when nothing is stocked, so drop the item entirely.
  const navItems = NAV_ITEMS.filter(
    (item) => item.menu !== "category" || (SECTIONS.categoryNav && categories.length > 0),
  );

  return (
    <header className="sticky top-0 z-40 bg-shell/95 backdrop-blur supports-[backdrop-filter]:bg-shell/80">
      {/* Promo bar */}
      {SECTIONS.promoBar && (
        <div className="relative z-40 bg-ink text-center text-xs font-medium text-white/90">
          <Container className="py-2">
            Free nationwide shipping on orders over {formatPHP(FREE_SHIPPING_THRESHOLD)} · Pay with
            GCash, Maya, GrabPay, QR Ph or card
          </Container>
        </div>
      )}

      <div className="border-b border-line" onMouseLeave={() => setActiveMenu(null)}>
        <div className="relative z-40 bg-shell">
          {/* Row 1 — logo · search · account · cart */}
          <Container className="flex h-16 items-center gap-3 lg:h-20 lg:gap-6">
            {/* Logo. The lockup already carries the company name, so there's no typed wordmark
                beside it — printing it twice is what the old square-mark-plus-text did.

                Served straight from public/ at this size — App Hosting bypasses the Next image
                optimizer, so whatever is on disk is what every visitor downloads. Pre-sized to 800px
                (2.4x the widest it's ever drawn) rather than shipping the 5120px source. The name is
                hyphenated on purpose: an `&` in a public path is read as a query delimiter and 404s.

                `width`/`height` are the file's real pixels (2.96:1); the height class drives the
                size and `w-auto` lets the ratio set the width.
                At h-14 it lands ~166px wide, near enough to the old mark+text footprint that nothing
                else in the row has to move. `alt=""` because the Link's aria-label already names it,
                and an aria-label overrides the element's contents. No radius: the artwork is
                transparent, so there's no plate to round — only a glyph to risk clipping. */}
            <Link href="/" className="flex shrink-0 items-center" aria-label={`${SITE.name} home`}>
              <Image
                src="/brand/rnr-logo-upscale.png"
                alt=""
                width={800}
                height={270}
                priority
                className="h-9 w-auto sm:h-11 lg:h-14"
              />
            </Link>

            {/* Search (desktop) — the primary action, so it fills everything between the logo and
                the actions. No max-width: capping it left slack on both sides of the bar. */}
            <SearchBar className="hidden w-full flex-1 lg:flex" productCount={productCount} />

            {/* Right actions. `-mr-2` optically squares the trailing icon button with the container
                edge — its glyph is inset inside a 40px hit area, so flush metrics read as short. */}
            <div className="-mr-2 ml-auto flex items-center gap-2 lg:ml-0">
              {/* Equipment buyers ask before they add to cart, so the quote route sits next to Cart.
                  Hidden below md, where it crowds the bar; the mobile drawer carries it instead.

                  The wrapper owns that visibility, not the button. `hidden` on the button itself
                  loses: LinkButton's base sets `inline-flex`, and Tailwind emits `.inline-flex`
                  after `.hidden`, so the later rule wins no matter how the classes are ordered in
                  the attribute. That kept this button on screen at every width. */}
              <span className="hidden md:inline-flex">
                <LinkButton
                  href="/contact"
                  variant="outline"
                  className="h-11 whitespace-nowrap px-4"
                >
                  Request a quote
                </LinkButton>
              </span>

              <CartButton variant="pill" />

              <AccountLink
                variant="icon"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg hover:bg-elevated"
              />

              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg hover:bg-elevated lg:hidden"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d={mobileOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </Container>

          {/* Row 2 — nav strip (desktop). Text-only and left-aligned: the search field above is
              already busy, and icons on both rows made the header shout. */}
          <nav className="hidden border-t border-line lg:block" aria-label="Primary">
            <Container>
              {/* `-ml-3` cancels the first item's own px-3 so its TEXT lands on the container edge,
                  level with the logo above it rather than 12px inside it. It sits on this inner row
                  rather than on Container, whose `mx-auto` a margin-left would override — that
                  would left-align the whole header instead of nudging the nav. */}
              <div className="-ml-3 flex h-12 items-center justify-start gap-1">
                {navItems.map((item) => {
                  if (item.menu) {
                    const key = item.menu;
                    return (
                      // `h-full` so the panel's `top-full` lands at the bottom of the nav ROW rather
                      // than the bottom of the button. The panel is a DOM descendant of the wrapper
                      // the header's onMouseLeave is on, so moving the pointer down into it doesn't
                      // count as leaving — mouseleave only fires once every descendant is exited.
                      <div key={key} className="relative flex h-full items-center">
                        <MenuTrigger
                          label={item.label}
                          menuKey={key}
                          activeMenu={activeMenu}
                          setActiveMenu={setActiveMenu}
                        />
                        {/* Brands only. Categories needs the full-width panel below — its tree is
                            too big for a 256px column — and that one can't live in here, because
                            `inset-x-0` would resolve against this wrapper (the trigger's width). */}
                        {activeMenu === key && key === "brand" && (
                          // `left-3` cancels the trigger's own px-3, so the panel's edge sits under
                          // the trigger's text. White on the warm shell, so it reads as raised.
                          <div
                            id={`menu-${key}`}
                            className="absolute left-3 top-full z-50 min-w-[16rem] rounded-2xl border border-line bg-surface py-2 shadow-xl"
                          >
                            <BrandMenu brands={brands} onNavigate={closeAll} />
                          </div>
                        )}
                      </div>
                    );
                  }
                  // href items only — the filter above guarantees one of the two is set.
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href!}
                      className={[
                        "flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-elevated hover:text-brand-700",
                        active ? "text-brand-700" : "text-fg",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </Container>
          </nav>
        </div>

        {/* Categories mega-menu. Out here rather than inside the trigger so `inset-x-0` resolves
            against the sticky <header> and the panel spans the page. Still a descendant of the
            wrapper carrying onMouseLeave, so moving the pointer into it doesn't close the menu. */}
        {activeMenu === "category" && (
          <div
            id="menu-category"
            className="absolute inset-x-0 top-full z-50 hidden border-b border-line bg-surface shadow-xl lg:block"
          >
            <Container className="py-8">
              <CategoryMenu categories={categories} onNavigate={closeAll} />
            </Container>
          </div>
        )}

        {/* Mobile drawer */}
        {mobileOpen && (
          <nav className="border-t border-line lg:hidden" aria-label="Mobile">
            <Container className="flex flex-col gap-1 py-4">
              <SearchBar className="mb-2 w-full" onSubmitted={closeAll} productCount={productCount} />

              {navItems.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                if (item.menu) {
                  const key = item.menu;
                  return (
                    <MobileAccordion
                      key={key}
                      label={item.label}
                      icon={<Icon className="text-brand-600" />}
                      open={mobileSection === key}
                      onToggle={() => setMobileSection((s) => (s === key ? null : key))}
                    >
                      {key === "category" ? (
                        <CategoryMenu categories={categories} onNavigate={closeAll} />
                      ) : (
                        <BrandMenu brands={brands} onNavigate={closeAll} />
                      )}
                    </MobileAccordion>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    onClick={closeAll}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
                  >
                    <Icon className="text-brand-600" />
                    {item.label}
                  </Link>
                );
              })}

              {/* The desktop bar's quote button is hidden below md — this is where it lands. */}
              <Link
                href="/contact"
                onClick={closeAll}
                className="mt-2 flex items-center justify-center rounded-lg border border-brand-800 px-3 py-3 text-sm font-semibold text-fg hover:bg-brand-800 hover:text-white"
              >
                Request a quote
              </Link>

              <AccountLink variant="row" onNavigate={closeAll} />
            </Container>
          </nav>
        )}
      </div>
    </header>
  );
}

function MenuTrigger({
  label,
  menuKey,
  activeMenu,
  setActiveMenu,
}: {
  label: string;
  menuKey: MenuKey;
  activeMenu: MenuKey | null;
  setActiveMenu: (m: MenuKey | null) => void;
}) {
  const active = activeMenu === menuKey;
  return (
    <button
      type="button"
      aria-haspopup="true"
      aria-expanded={active}
      aria-controls={`menu-${menuKey}`}
      onMouseEnter={() => setActiveMenu(menuKey)}
      onClick={() => setActiveMenu(active ? null : menuKey)}
      className={[
        "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-elevated hover:text-brand-700",
        active ? "text-brand-700" : "text-fg",
      ].join(" ")}
    >
      {label}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={["transition-transform", active ? "rotate-180" : ""].join(" ")}
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function MobileAccordion({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
      >
        {icon}
        {label}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={["ml-auto transition-transform", open ? "rotate-180" : ""].join(" ")}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-3 pb-4 pt-1">{children}</div>}
    </div>
  );
}

