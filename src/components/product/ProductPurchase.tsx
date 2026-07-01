"use client";

import { useEffect, useState } from "react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { trackViewItem } from "@/lib/analytics";
import type { CartItem } from "@/lib/cart";

/**
 * Quantity stepper + add-to-cart for the product page. Fires a `view_item` analytics event
 * once on mount (the key top-of-funnel signal for retargeting).
 */
export function ProductPurchase({
  item,
  inStock,
}: {
  item: Omit<CartItem, "quantity">;
  inStock: boolean;
}) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    trackViewItem({
      id: item.sku,
      name: item.name,
      category: item.category,
      price: item.price,
    });
  }, [item.sku, item.name, item.category, item.price]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="inline-flex items-center rounded-lg border border-line">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
          disabled={!inStock}
          className="h-11 w-11 text-lg text-muted hover:text-fg disabled:opacity-40"
        >
          −
        </button>
        <span className="w-10 text-center text-base font-semibold">{qty}</span>
        <button
          onClick={() => setQty((q) => q + 1)}
          aria-label="Increase quantity"
          disabled={!inStock}
          className="h-11 w-11 text-lg text-muted hover:text-fg disabled:opacity-40"
        >
          +
        </button>
      </div>

      <AddToCartButton item={item} quantity={qty} disabled={!inStock} size="lg" fullWidth />
    </div>
  );
}
