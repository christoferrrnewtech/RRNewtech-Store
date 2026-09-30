"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Fires a Pixel PageView on client-side navigations. The loader snippet only tracks the first
 * hard load; after that Next.js swaps pages without a reload, so Meta would otherwise see one
 * PageView per visit however many pages were browsed.
 *
 * Compares against the last tracked path rather than skipping the first effect run, so React's
 * dev double-invoke of effects can't send a duplicate for the initial page.
 */
export function MetaPixelPageViews() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackPageView();
  }, [pathname]);

  return null;
}
