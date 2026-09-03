"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/cart/CartButton";
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
}: {
  brands: BrandLink[];
  categories: MenuCategory[];
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
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
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
        <div className="relative z-40 bg-surface">
          {/* Row 1 — logo · search · account · cart */}
          <Container className="flex h-16 items-center gap-3 lg:h-20 lg:gap-6">
            {/* Logo */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-3"
              aria-label={`${SITE.name} home`}
            >
              <Image
                src="/brand/logo.png"
                alt={`${SITE.name} logo`}
                width={44}
                height={44}
                priority
                className="h-10 w-10 rounded-lg lg:h-11 lg:w-11"
              />
              <span className="hidden text-base font-bold leading-tight text-fg sm:block lg:text-lg">
                Newtech <span className="text-brand-600">Dental</span>
              </span>
            </Link>

            {/* Search (desktop) — the primary action, so it takes the width the old nav row used. */}
            <SearchBar className="mx-auto hidden w-full max-w-2xl flex-1 lg:flex" />

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Link
                href="/account"
                className="hidden h-11 items-center gap-2 rounded-full border border-line px-4 text-fg hover:border-brand-600 hover:text-brand-700 lg:flex"
              >
                <UserIcon />
                <span className="flex flex-col leading-tight">
                  <span className="text-[11px] text-muted">Account</span>
                  <span className="text-sm font-bold">Login</span>
                </span>
              </Link>
              <Link
                href="/account"
                aria-label="Account"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg hover:bg-elevated lg:hidden"
              >
                <UserIcon />
              </Link>

              <CartButton variant="pill" />

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

          {/* Row 2 — icon nav strip (desktop) */}
          <nav className="hidden border-t border-line lg:block" aria-label="Primary">
            <Container className="flex h-12 items-center justify-center gap-1">
              {navItems.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                if (item.menu) {
                  return (
                    <MenuTrigger
                      key={item.menu}
                      label={item.label}
                      icon={<Icon />}
                      menuKey={item.menu}
                      activeMenu={activeMenu}
                      setActiveMenu={setActiveMenu}
                    />
                  );
                }
                // href items only — the filter above guarantees one of the two is set.
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={[
                      "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold hover:bg-elevated hover:text-brand-700",
                      active ? "text-brand-700" : "text-fg",
                    ].join(" ")}
                  >
                    <Icon className="text-brand-600" />
                    {item.label}
                  </Link>
                );
              })}
            </Container>
          </nav>
        </div>

        {/* Desktop mega-menu panel */}
        {activeMenu && (
          <div
            id={`menu-${activeMenu}`}
            className="absolute inset-x-0 top-full z-40 hidden border-b border-line bg-surface shadow-xl lg:block"
          >
            <Container className="py-8">
              {activeMenu === "category" ? (
                <CategoryMenu categories={categories} onNavigate={closeAll} />
              ) : (
                <BrandMenu brands={brands} onNavigate={closeAll} />
              )}
            </Container>
          </div>
        )}

        {/* Mobile drawer */}
        {mobileOpen && (
          <nav className="border-t border-line lg:hidden" aria-label="Mobile">
            <Container className="flex flex-col gap-1 py-4">
              <SearchBar className="mb-2 w-full" onSubmitted={closeAll} />

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

              <Link
                href="/account"
                onClick={closeAll}
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
              >
                <UserIcon />
                Login or Register
              </Link>
            </Container>
          </nav>
        )}
      </div>
    </header>
  );
}

function MenuTrigger({
  label,
  icon,
  menuKey,
  activeMenu,
  setActiveMenu,
}: {
  label: string;
  icon: React.ReactNode;
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
        "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold hover:bg-elevated hover:text-brand-700",
        active ? "text-brand-700" : "text-fg",
      ].join(" ")}
    >
      <span className="text-brand-600">{icon}</span>
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

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
