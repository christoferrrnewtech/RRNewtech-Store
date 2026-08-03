"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND_EDITOR_SECTIONS } from "./sections";

/**
 * Sticky tab rail for the brand editor's sections. Most tabs are anchor links that scroll — every
 * section stays mounted — so the active tab is driven by scroll position rather than by clicks
 * alone. A tab bar that never highlights anything reads as broken, which is the whole reason this
 * tracks position instead of just restyling the old chips.
 *
 * Products is the exception: it lives on its own route, so its tab is a real link and it owns the
 * rail outright while you're on that page.
 *
 * Deliberately NOT role="tablist"/role="tab": those roles promise that activating a tab swaps a
 * panel. These either jump to a heading or navigate, so they stay plain links marked aria-current.
 */
export function SectionTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/admin/brands/${slug}`;

  const routeSection = BRAND_EDITOR_SECTIONS.find((s) => s.path && pathname === `${base}${s.path}`);
  const onMain = !routeSection;

  const [scrolled, setScrolled] = useState<string>(BRAND_EDITOR_SECTIONS[0].id);
  const active = routeSection ? routeSection.id : scrolled;
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    // Off the main page the anchors don't exist, so there's nothing to observe.
    if (!onMain) return;

    const targets = BRAND_EDITOR_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        // Narrow band near the top, so "active" means "the section you're reading", not
        // "any section on screen". Topmost in document order wins.
        const current = BRAND_EDITOR_SECTIONS.find((s) => visible.get(s.id));
        if (current) setScrolled(current.id);
      },
      { rootMargin: "-88px 0px -60% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onMain]);

  // With nine tabs the active one can sit outside the horizontal overflow on a narrow screen.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  return (
    <nav
      aria-label="Editor sections"
      className="sticky top-0 z-10 -mx-1 mt-4 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-1 backdrop-blur"
    >
      {BRAND_EDITOR_SECTIONS.map((s) => {
        const isActive = s.id === active;
        const className = [
          // -mb-px drops the underline onto the rail's own border instead of floating above it.
          "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
          isActive
            ? "border-brand-600 text-brand-700"
            : "border-transparent text-muted hover:border-line-strong hover:text-fg",
        ].join(" ");
        const ref = isActive ? activeRef : undefined;
        const ariaCurrent = isActive ? ("true" as const) : undefined;

        // A plain hash jump only works when the target is on this page.
        if (onMain && !s.path) {
          return (
            <a
              key={s.id}
              ref={ref}
              href={`#${s.id}`}
              // Highlight on click rather than waiting for the scroll to settle.
              onClick={() => setScrolled(s.id)}
              aria-current={ariaCurrent}
              className={className}
            >
              {s.label}
            </a>
          );
        }

        return (
          <Link
            key={s.id}
            ref={ref}
            href={s.path ? `${base}${s.path}` : `${base}#${s.id}`}
            aria-current={ariaCurrent}
            className={className}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
