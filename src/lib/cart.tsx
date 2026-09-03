"use client";

/**
 * Client-side shopping cart — React context + localStorage persistence.
 *
 * The cart is entirely client-side and stores no customer identity. It holds a denormalized
 * snapshot of each line so the cart renders without re-fetching products; checkout posts only the
 * ids and quantities for the server to reprice.
 *
 * SIGN-IN GATE: the two ways into the cart — `addItem` and `openCart` — are both gated here rather
 * than in the buttons, so a future caller gets the gate for free instead of having to remember it.
 * Note the internal/public split that makes that hold: `commitAdd` and `setIsOpen` are the
 * ungated primitives, and the gate sits on the public API wrapping them. That is why adding an
 * item still pops the drawer open without tripping the `openCart` gate on the way.
 *
 * It is a PROMPT, not enforcement: the check reads an unsigned cookie hint (see customer-hint.ts)
 * that anyone can forge, and the cart is localStorage either way. Real gating has to be
 * server-side, in the route that matters.
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
import { hasCustomerSessionHint } from "@/lib/customer-hint";

export type { CartItem, NewCartItem } from "@/lib/cart-item";
export { MAX_QUANTITY } from "@/lib/cart-item";

const STORAGE_KEY = "rrnewtech.cart.v2";

/**
 * Older storage keys, cleared on hydration. v1 lines keyed on a bare `slug` that mixed the catalog
 * and brand id namespaces, and never stored a brand slug — so their detail URLs can't be rebuilt.
 * Dropping them is deliberate; migrating would only preserve broken links.
 */
const LEGACY_KEYS = ["rrnewtech.cart.v1"];

/**
 * Where a gated add is parked while the visitor goes off to sign in.
 *
 * Without this, "sign in first" silently costs them the item they picked — they come back to an
 * empty cart and have to find the product again, which is worse than not gating at all. Stashed in
 * localStorage rather than memory because signing in is a full page load.
 */
const PENDING_ADD_KEY = "rrnewtech.cart.pendingAdd";

/** How long a parked item stays claimable. Long enough to register an account, short enough that
 *  a forgotten one doesn't surprise someone days later. */
const PENDING_ADD_TTL_MS = 60 * 60 * 1000;

type PendingAdd = { item: NewCartItem; quantity: number; at: number };

/**
 * What the visitor was trying to do when the prompt went up. Carried rather than inferred, because
 * the two cases promise different things: a blocked add parks the item ("we'll keep this for you"),
 * a blocked cart-open has nothing to park and must not claim otherwise.
 */
export type AuthPromptReason = "add" | "view";

function readPendingAdd(): PendingAdd | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_ADD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { item, quantity, at } = parsed as Partial<PendingAdd>;
    // Same defensive posture as the cart lines themselves: this data outlives deploys.
    if (!isCartItem({ ...item, quantity: 1 }) || typeof at !== "number") return null;
    if (Date.now() - at > PENDING_ADD_TTL_MS) return null;
    return { item: item as NewCartItem, quantity: clampQuantity(Number(quantity) || 1), at };
  } catch {
    return null;
  }
}

function writePendingAdd(value: PendingAdd | null): void {
  try {
    if (value) window.localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(PENDING_ADD_KEY);
  } catch {
    /* storage full / disabled — the gate still works, the item just isn't parked */
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Adds the line, or returns false having raised the sign-in prompt instead. */
  addItem: (item: NewCartItem, quantity?: number) => boolean;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /** Which action the visitor was blocked from, or null when no prompt is showing. */
  authPrompt: AuthPromptReason | null;
  closeAuthPrompt: () => void;
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

  const [authPrompt, setAuthPrompt] = useState<AuthPromptReason | null>(null);

  /**
   * The unconditional add. Everything that actually puts a line in the cart goes through here, so
   * the gate in `addItem` below can't be sidestepped by a caller that "just needs to add one".
   */
  const commitAdd = useCallback((item: NewCartItem, quantity: number) => {
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

  const addItem = useCallback<CartContextValue["addItem"]>(
    (item, quantity = 1) => {
      // Read at click time rather than from state: by the time anyone can click, the document
      // exists, so there is no hydration mismatch to design around and no stale snapshot to
      // refresh when the visitor signs in from another tab.
      if (!hasCustomerSessionHint()) {
        writePendingAdd({ item, quantity: clampQuantity(quantity), at: Date.now() });
        setAuthPrompt("add");
        return false;
      }
      commitAdd(item, quantity);
      return true;
    },
    [commitAdd],
  );

  const closeAuthPrompt = useCallback(() => {
    setAuthPrompt(null);
    // Dismissing the prompt is a decision not to sign in, so the parked item goes with it —
    // otherwise it would reappear in their cart on some unrelated later visit.
    writePendingAdd(null);
  }, []);

  // Claim a parked item once the visitor comes back signed in. Runs after the cart has hydrated so
  // the replayed line merges with the stored cart instead of racing it.
  useEffect(() => {
    if (!hydrated) return;
    const pending = readPendingAdd();
    if (!pending) return;
    // Still signed out — they landed back here without finishing. Leave it parked until its TTL.
    if (!hasCustomerSessionHint()) return;
    writePendingAdd(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time claim from localStorage, same as the hydration effect above
    commitAdd(pending.item, pending.quantity);
  }, [hydrated, commitAdd]);

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

  /**
   * Opening the cart from the header. Gated like `addItem`: a signed-out visitor has nothing in
   * there to see, so the drawer would only ever say "your cart is empty" — the prompt is both more
   * useful and more honest. Nothing is parked, since no product was chosen.
   */
  const openCart = useCallback(() => {
    if (!hasCustomerSessionHint()) {
      setAuthPrompt("view");
      return;
    }
    setIsOpen(true);
  }, []);
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
    authPrompt,
    closeAuthPrompt,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
