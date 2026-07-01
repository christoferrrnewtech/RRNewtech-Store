"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCart, type CartItem } from "@/lib/cart";

/**
 * Adds a product to the cart. Accepts a ready-made cart line (minus quantity) so both the
 * product card (qty 1) and the product page (chosen qty) can reuse it.
 */
export function AddToCartButton({
  item,
  quantity = 1,
  disabled = false,
  size = "md",
  fullWidth = false,
  label = "Add to cart",
}: {
  item: Omit<CartItem, "quantity">;
  quantity?: number;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  label?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <Button variant="secondary" size={size} disabled className={fullWidth ? "w-full" : undefined}>
        Out of stock
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={fullWidth ? "w-full" : undefined}
      onClick={() => {
        addItem(item, quantity);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
    >
      {added ? "Added ✓" : label}
    </Button>
  );
}
