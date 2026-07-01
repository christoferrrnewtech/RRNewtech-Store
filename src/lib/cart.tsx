"use client";

/**
 * Client-side shopping cart — React context + localStorage persistence.
 *
 * PHASE 1: the cart is entirely client-side (no server, no payment). It stores a denormalized
 * snapshot of each line so the cart renders without re-fetching products. PHASE 2 (checkout)
 * reads `items` to build the order and hand off to PayMongo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trackAddToCart } from "@/lib/analytics";

const STORAGE_KEY = "rrnewtech.cart.v1";

export type CartItem = {
  slug: string;
  name: string;
  price: number;
  unit: string;
  sku: string;
  category: string;
  image: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart after mount. localStorage is unavailable during SSR, so this must run
  // in an effect (not a lazy initializer) to keep the server and first client render identical.
  useEffect(() => {
    const stored = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    if (stored.length > 0) setItems(stored);
    setHydrated(true);
  }, []);

  // Persist on change (once hydrated so we never clobber storage with the empty initial state).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / disabled — cart still works in-memory */
    }
  }, [items, hydrated]);

  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === item.slug);
      if (existing) {
        return prev.map((i) =>
          i.slug === item.slug ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { ...item, quantity }];
    });
    trackAddToCart({
      id: item.sku,
      name: item.name,
      category: item.category,
      price: item.price,
      quantity,
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback<CartContextValue["updateQuantity"]>((slug, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) => (i.slug === slug ? { ...i, quantity } : i)),
    );
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((slug) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const { count, subtotal } = useMemo(() => {
    return items.reduce(
      (acc, i) => {
        acc.count += i.quantity;
        acc.subtotal += i.quantity * i.price;
        return acc;
      },
      { count: 0, subtotal: 0 },
    );
  }, [items]);

  const value: CartContextValue = {
    items,
    count,
    subtotal,
    isOpen,
    openCart,
    closeCart,
    addItem,
    updateQuantity,
    removeItem,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
