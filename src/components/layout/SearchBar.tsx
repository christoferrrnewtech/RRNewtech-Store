"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * Catalog search box. Submitting navigates to /?q=<term> so the shop page filters
 * server-side. Seeded from the current URL's `q` on mount (avoids useSearchParams so the
 * layout-level header doesn't force a Suspense boundary on otherwise-static pages).
 */
export function SearchBar({
  className,
  onSubmitted,
}: {
  className?: string;
  /** Optional callback after submit (e.g. close the mobile drawer). */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setTerm(q);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
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
        placeholder="Search dental products…"
        aria-label="Search products"
        className="h-11 w-full rounded-full border border-line-strong bg-surface pl-11 pr-4 text-sm text-fg placeholder:text-muted-light focus:border-brand-500 focus:outline-none lg:h-12"
      />
    </form>
  );
}
