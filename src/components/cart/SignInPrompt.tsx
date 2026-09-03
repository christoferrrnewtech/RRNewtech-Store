"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart, type AuthPromptReason } from "@/lib/cart";

/**
 * Sign-in dialog, raised by the cart store when a signed-out visitor tries to add an item or open
 * the cart.
 *
 * Rendered once in the storefront layout alongside CartDrawer, rather than per button, so the
 * prompt is a single element no matter how many Add-to-cart controls a page has.
 *
 * The copy varies by which action was blocked. A blocked ADD has parked the item and can promise
 * to keep it; a blocked cart-open has no item to park, so it must not make that promise — the
 * whole reason the store carries a reason rather than a bare boolean.
 */
const COPY: Record<AuthPromptReason, { title: string; body: string }> = {
  add: {
    title: "Sign in to add to your cart",
    body:
      "R&R Newtech supplies licensed dental professionals, so we ask you to sign in before " +
      "ordering. We'll keep this item for you.",
  },
  view: {
    title: "Sign in to view your cart",
    body:
      "R&R Newtech supplies licensed dental professionals, so we ask you to sign in before " +
      "ordering. Sign in to start building your cart.",
  },
};

export function SignInPrompt() {
  const { authPrompt, closeAuthPrompt } = useCart();
  const authPromptOpen = authPrompt !== null;

  // Lock body scroll while open, and close on Escape — same treatment as CartDrawer.
  useEffect(() => {
    if (!authPromptOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAuthPrompt();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [authPromptOpen, closeAuthPrompt]);

  if (!authPrompt) return null;
  const copy = COPY[authPrompt];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        onClick={closeAuthPrompt}
        className="absolute inset-0 bg-ink/40 transition-opacity duration-200"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-prompt-title"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8"
      >
        <button
          onClick={closeAuthPrompt}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-brand-600"
              aria-hidden="true"
            >
              <path
                d="M6 10V7a6 6 0 1112 0v3M5 10h14a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2
            id="signin-prompt-title"
            className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-fg"
          >
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>

          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/account/login"
              className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign in
            </Link>
            <Link
              href="/account/register"
              className="rounded-lg border border-line bg-surface px-5 py-3 text-sm font-semibold text-fg hover:bg-elevated"
            >
              Create an account
            </Link>
            <button
              onClick={closeAuthPrompt}
              className="mt-1 text-sm font-medium text-muted hover:text-fg"
            >
              Keep browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
