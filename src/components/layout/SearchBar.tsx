"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * Catalog search box. Submitting navigates to /shop?q=<term>, which filters the brand catalog
 * server-side. Follows the URL's `q`, so the box empties when the search is cleared and shows the
 * term when a search link is opened directly. useSearchParams is safe in this layout-level header
 * because the storefront renders dynamically (see the store layout's `dynamic` export).
 */
export function SearchBar({
  className,
  onSubmitted,
  productCount,
}: {
  className?: string;
  /** Optional callback after submit (e.g. close the mobile drawer). */
  onSubmitted?: () => void;
  /** Catalog size, named in the placeholder so the box advertises what's behind it. */
  productCount?: number;
}) {
  const router = useRouter();
  const urlTerm = useSearchParams().get("q") ?? "";
  const [term, setTerm] = useState(urlTerm);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the source of truth; typing edits a local draft of it
    setTerm(urlTerm);
  }, [urlTerm]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onSubmitted?.();
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={["relative flex items-center", className].filter(Boolean).join(" ")}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute left-4 text-muted-light"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={
          productCount
            ? `Search ${productCount} products, brands or equipment…`
            : "Search dental products…"
        }
        aria-label="Search products"
        className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-11 pr-4 text-sm text-fg placeholder:text-muted-light focus:border-brand-500 focus:outline-none lg:h-12"
      />
    </form>
  );
}
