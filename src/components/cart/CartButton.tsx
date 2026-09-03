"use client";

import { useCart } from "@/lib/cart";

/**
 * `icon` — bare 40px icon button with a corner count badge.
 * `pill` — solid brand pill with a "Cart" label and an inline count chip, for the header bar.
 */
export function CartButton({ variant = "icon" }: { variant?: "icon" | "pill" }) {
  const { count, openCart } = useCart();

  const label = `Open cart${count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`;

  if (variant === "pill") {
    return (
      <button
        onClick={openCart}
        aria-label={label}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 sm:px-5"
      >
        <CartIcon />
        <span className="hidden sm:inline">Cart</span>
        {count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
            {count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={openCart}
      aria-label={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg hover:bg-elevated"
    >
      <CartIcon />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2l2.4 12.3a1 1 0 0 0 1 .7h8.7a1 1 0 0 0 1-.8L21 8H6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}
