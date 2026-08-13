"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useCart, MAX_QUANTITY } from "@/lib/cart";
import { formatPHP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { PAYMENT_METHODS_SENTENCE } from "@/lib/payment-methods";

/**
 * Slide-over cart. The primary action goes to checkout, which collects delivery details and hands
 * off to PayMongo for payment; sending the cart as an inquiry (Contact page) remains
 * for bulk and contact-sales enquiries.
 */
export function CartDrawer() {
  const { items, isOpen, closeCart, subtotal, count, updateQuantity, removeItem, clear } =
    useCart();

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-fg">
            Your cart {count > 0 && <span className="text-muted">({count})</span>}
          </h2>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-muted">Your cart is empty.</p>
            <Link
              href="/"
              onClick={closeCart}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {remaining > 0 ? (
                <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-brand-700">
                  Add {formatPHP(remaining)} more to qualify for free shipping.
                </p>
              ) : (
                <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-brand-700">
                  🎉 You&apos;ve unlocked free shipping!
                </p>
              )}

              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-3">
                    <Link
                      href={item.href}
                      onClick={closeCart}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-elevated"
                    >
                      <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={item.href}
                        onClick={closeCart}
                        className="line-clamp-2 text-sm font-semibold text-fg hover:text-brand-700"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatPHP(item.price)}
                        {item.unit && ` / ${item.unit}`}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-line">
                          <button
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="h-8 w-8 text-muted hover:text-fg"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                            disabled={item.quantity >= MAX_QUANTITY}
                            className="h-8 w-8 text-muted hover:text-fg disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.key)}
                          className="text-xs text-muted-light hover:text-danger"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-fg">
                      {formatPHP(item.price * item.quantity)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="border-t border-line px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted">Subtotal</span>
                <span className="text-lg font-bold text-fg">{formatPHP(subtotal)}</span>
              </div>
              <div className="mb-3 flex justify-end">
                <button
                  onClick={clear}
                  className="text-xs text-muted-light hover:text-danger"
                >
                  Clear cart
                </button>
              </div>
              <p className="mb-3 text-xs text-muted-light">
                Shipping is calculated at checkout, where you can pay securely with{" "}
                {PAYMENT_METHODS_SENTENCE}.
              </p>
              <Link
                href="/cart"
                onClick={closeCart}
                className="mb-2 block rounded-lg border border-line bg-surface px-5 py-2.5 text-center text-sm font-semibold text-fg hover:bg-elevated"
              >
                View cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="block rounded-lg bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Checkout
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
