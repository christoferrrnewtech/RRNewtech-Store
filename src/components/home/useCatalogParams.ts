"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Set (or clear, by passing "") one catalog search param, preserving the rest.
 *
 * Shared by the toolbar's Price and Sort controls so the two can't drift apart on param semantics.
 * `scroll: false` because both sit directly above the grid — jumping to the top on every change
 * would throw away the reader's place for no reason.
 *
 * The sidebar deliberately doesn't use this: its rows are real links, so they build hrefs instead of
 * pushing, which makes a filtered view middle-clickable and crawlable.
 */
export function useSetCatalogParam(): (key: string, value: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, params],
  );
}
