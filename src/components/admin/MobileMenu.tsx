"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * On a phone the admin sidebar sits above the page, and fully expanded — ten links and the account
 * block — it pushed every page's content below the fold. Below `lg` it folds behind a Menu button;
 * from `lg` up it's the ordinary sidebar and the button disappears.
 *
 * Closes itself on navigation, so picking a page doesn't leave the menu covering it.
 */
export function MobileMenu({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Render-time reset on route change — React's pattern for deriving state from a changed value.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-menu"
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-fg hover:bg-elevated lg:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div id="admin-menu" className={`${open ? "flex" : "hidden"} flex-1 flex-col lg:flex`}>
        {children}
      </div>
    </>
  );
}
