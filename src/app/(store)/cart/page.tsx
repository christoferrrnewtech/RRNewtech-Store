"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { useCart, MAX_QUANTITY } from "@/lib/cart";
import { formatPHP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <Container className="py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Your cart
      </h1>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <LinkButton href="/" className="mt-5">
            Browse the shop
          </LinkButton>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
          {/* Line items */}
          <div>
            <ul className="divide-y divide-line border-y border-line">
              {items.map((item) => (
                <li key={item.key} className="flex gap-4 py-5">
                  <Link
                    href={item.href}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-elevated"
                  >
                    <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={item.href}
                      className="font-semibold text-fg hover:text-brand-700"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatPHP(item.price)}
                      {item.unit && ` / ${item.unit}`}
                    </p>
                    <div className="mt-auto flex items-center gap-4 pt-3">
                      <div className="inline-flex items-center rounded-lg border border-line">
                        <button
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="h-9 w-9 text-muted hover:text-fg"
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          aria-label="Increase quantity"
                          disabled={item.quantity >= MAX_QUANTITY}
                          className="h-9 w-9 text-muted hover:text-fg disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-sm text-muted-light hover:text-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 font-bold text-fg">
                    {formatPHP(item.price * item.quantity)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between">
              <Link href="/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                ← Continue shopping
              </Link>
              <button onClick={clear} className="text-sm text-muted-light hover:text-danger">
                Clear cart
              </button>
            </div>
          </div>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-lg font-bold text-fg">Order summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-fg">{formatPHP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Shipping</span>
                <span className="text-muted">
                  {remaining > 0 ? "Calculated at checkout" : "Free"}
                </span>
              </div>
            </div>

            {remaining > 0 ? (
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-brand-700">
                Add {formatPHP(remaining)} more for free shipping.
              </p>
            ) : (
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-brand-700">
                🎉 You&apos;ve unlocked free shipping!
              </p>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <div className="flex justify-between text-base">
                <span className="font-semibold text-fg">Total</span>
                <span className="font-extrabold text-fg">{formatPHP(subtotal)}</span>
              </div>
            </div>

            <LinkButton href="/contact?inquiry=cart" size="lg" className="mt-5 w-full">
              Send as inquiry
            </LinkButton>
            <p className="mt-3 text-xs leading-relaxed text-muted-light">
              Online payment (GCash, Maya, card) via a secure Philippine gateway is coming soon.
              For now, send your cart and our team will confirm stock, shipping, and payment.
            </p>
          </aside>
        </div>
      )}
    </Container>
  );
}
