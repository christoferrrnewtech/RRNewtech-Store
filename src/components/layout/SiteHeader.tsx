"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/cart/CartButton";
import { SearchBar } from "@/components/layout/SearchBar";
import { CategoryMenu, type MenuCategory } from "@/components/layout/CategoryMenu";
import { BrandMenu, type BrandLink } from "@/components/layout/BrandMenu";
import { NAV_LINKS, SECTIONS, SITE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
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

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      {/* Promo bar */}
      <div className="relative z-40 bg-ink text-center text-xs font-medium text-white/90">
        <Container className="py-2">
          Free nationwide shipping on orders over {formatPHP(FREE_SHIPPING_THRESHOLD)} · GCash &amp;
          Maya coming soon
        </Container>
      </div>

      <div className="border-b border-line" onMouseLeave={() => setActiveMenu(null)}>
        <div className="relative z-40 bg-surface">
          <Container className="flex h-16 items-center gap-4">
            {/* Logo */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-3 pr-2"
              aria-label={`${SITE.name} home`}
            >
              <Image
                src="/brand/logo.png"
                alt={`${SITE.name} logo`}
                width={36}
                height={36}
                priority
                className="h-9 w-9 rounded-lg"
              />
              <span className="hidden text-base font-bold leading-tight text-fg sm:block">
                Newtech <span className="text-brand-600">Dental</span>
              </span>
            </Link>

            {/* Primary nav (desktop) */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-elevated hover:text-brand-700"
                >
                  {link.label}
                </Link>
              ))}
              {SECTIONS.categoryNav && (
                <MenuTrigger
                  label="Categories"
                  menuKey="category"
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                />
              )}
              <MenuTrigger
                label="Brand"
                menuKey="brand"
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
              />
            </nav>

            {/* Search (desktop) */}
            <SearchBar className="mx-2 hidden max-w-md flex-1 lg:flex" />

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-1 lg:ml-0">
              <CartButton />
              <Link
                href="/account"
                className="ml-1 hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-elevated hover:text-brand-700 lg:flex"
              >
                <UserIcon />
                Login or Register
              </Link>
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

              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeAll}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
                >
                  {link.label}
                </Link>
              ))}

              {SECTIONS.categoryNav && (
                <MobileAccordion
                  label="Categories"
                  open={mobileSection === "category"}
                  onToggle={() =>
                    setMobileSection((s) => (s === "category" ? null : "category"))
                  }
                >
                  <CategoryMenu categories={categories} onNavigate={closeAll} />
                </MobileAccordion>
              )}

              <MobileAccordion
                label="Brand"
                open={mobileSection === "brand"}
                onToggle={() => setMobileSection((s) => (s === "brand" ? null : "brand"))}
              >
                <BrandMenu brands={brands} onNavigate={closeAll} />
              </MobileAccordion>

              <Link
                href="/account"
                onClick={closeAll}
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
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
        "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium hover:bg-elevated",
        active ? "text-brand-700" : "text-fg hover:text-brand-700",
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
  open,
  onToggle,
  children,
}: {
  label: string;
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
        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
      >
        {label}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={["transition-transform", open ? "rotate-180" : ""].join(" ")}
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
