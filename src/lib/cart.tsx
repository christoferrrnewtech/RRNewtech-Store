"use client";

/**
 * Client-side shopping cart — React context + localStorage persistence.
 *
 * The cart is entirely client-side and fully anonymous — nothing here needs or collects a customer
 * identity. It stores a denormalized snapshot of each line so the cart renders without re-fetching
 * products; checkout posts only the ids and quantities for the server to reprice.
 *
 * PRICE DRIFT: because each line snapshots its price, a cart left for weeks can hold a figure that
 * no longer matches the catalog. `subtotal` here is DISPLAY ONLY — `placeOrderAction` re-reads
 * every price from Firestore and re-quotes shipping before a peso reaches PayMongo.
 *
 * The line model, its builders, and its runtime guard live in `cart-item.ts` so Server Components
 * can build lines without importing this `"use client"` module.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trackAddToCart } from "@/lib/analytics";
import { clampQuantity, isCartItem, type CartItem, type NewCartItem } from "@/lib/cart-item";

export type { CartItem, NewCartItem } from "@/lib/cart-item";
export { MAX_QUANTITY } from "@/lib/cart-item";

const STORAGE_KEY = "rrnewtech.cart.v2";

/**
 * Older storage keys, cleared on hydration. v1 lines keyed on a bare `slug` that mixed the catalog
 * and brand id namespaces, and never stored a brand slug — so their detail URLs can't be rebuilt.
 * Dropping them is deliberate; migrating would only preserve broken links.
 */
const LEGACY_KEYS = ["rrnewtech.cart.v1"];

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: NewCartItem, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Parse a persisted payload, dropping any line that fails validation. */
function parseItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    // Validate every line: this data outlives deploys, so it may predate the current shape.
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseItems(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Mirrors the last payload this tab wrote or received, so the storage listener can tell a real
  // change from an echo of our own write and avoid a set/persist ping-pong between tabs.
  const lastPayload = useRef<string | null>(null);

  // Load persisted cart after mount. localStorage is unavailable during SSR, so this must run
  // in an effect (not a lazy initializer) to keep the server and first client render identical.
  useEffect(() => {
    const stored = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    if (stored.length > 0) setItems(stored);
    setHydrated(true);

    try {
      for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
    } catch {
      /* storage disabled — nothing to clean up */
    }
  }, []);

  // Persist on change (once hydrated so we never clobber storage with the empty initial state).
  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify(items);
    lastPayload.current = payload;
    try {
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      /* storage full / disabled — cart still works in-memory */
    }
  }, [items, hydrated]);

  // Keep other tabs in sync. `storage` fires only in tabs that did not perform the write.
  useEffect(() => {
    if (!hydrated) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      // Ignore an echo of a payload we already hold — otherwise each tab's persist effect would
      // re-broadcast and the two would bounce updates back and forth.
      if (e.newValue === lastPayload.current) return;
      lastPayload.current = e.newValue;
      setItems(parseItems(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated]);

  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    const qty = clampQuantity(quantity);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key);
      if (existing) {
        return prev.map((i) =>
          i.key === item.key ? { ...i, quantity: clampQuantity(i.quantity + qty) } : i,
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
    trackAddToCart({
      id: item.sku,
      name: item.name,
      category: item.category,
      price: item.price,
      quantity: qty,
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback<CartContextValue["updateQuantity"]>((key, quantity) => {
    setItems((prev) =>
      // Stepping below 1 removes the line; anything else is clamped to a whole, in-range quantity.
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity: clampQuantity(quantity) } : i)),
    );
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
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
