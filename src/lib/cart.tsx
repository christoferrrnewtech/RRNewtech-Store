"use client";

/**
 * Shopping cart — React context, localStorage, and a durable server copy for signed-in customers.
 *
 * localStorage is the WORKING COPY and always will be: it is what makes Add-to-cart instant, what
 * renders the cart before any network call, and what keeps the cart usable when Firestore is
 * unreachable. Every mutation lands there first and synchronously.
 *
 * For a signed-in customer, `customer-cart.ts` holds the DURABLE COPY under their own profile, and
 * the two are reconciled once per page load. That is what makes a cart survive clearing site data,
 * a private window, a second device, or signing out on a shared clinic machine — all of which
 * previously lost it outright. The reconciliation rules, and why each of the three is different,
 * are documented on `reconcileCarts`; this module's job is to feed it honest inputs, in particular
 * the `dirty` flag that says "this browser holds changes the server has not confirmed".
 *
 * A guest's cart is unchanged: localStorage only, because there is nowhere durable to put it.
 *
 * It holds a denormalized snapshot of each line so the cart renders without re-fetching products;
 * checkout posts only the ids and quantities for the server to reprice.
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
import { usePathname } from "next/navigation";
import { trackAddToCart } from "@/lib/analytics";
import { clampQuantity, isCartItem, type CartItem, type NewCartItem } from "@/lib/cart-item";
import { hasCustomerSessionHint } from "@/lib/customer-hint";
import { saveCartAction, syncCartAction } from "@/app/(store)/cart-actions";

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

/**
 * Which account the stored cart belongs to — an opaque token minted server-side by
 * `cartOwnerToken`. The browser can't read the uid (the customer session is httpOnly), and this is
 * how it tells "my own stale mirror" from "the cart of whoever used this machine before me".
 * Meaningless on its own and grants nothing; see the note on `cartOwnerToken`.
 */
const OWNER_KEY = "rrnewtech.cart.owner";

/**
 * Set the instant the cart changes, cleared only once the server CONFIRMS the save.
 *
 * The whole point is that it is written synchronously, before the debounced save runs: a tab closed
 * mid-debounce leaves this behind, and the next load unions instead of mirroring rather than
 * discarding what the customer just did. See `reconcileCarts`.
 */
const DIRTY_KEY = "rrnewtech.cart.dirty";

/** Long enough to collapse a burst on the quantity stepper, short enough that a closing tab
 *  usually loses nothing. `dirty` is what makes it safe when it doesn't. */
const SAVE_DEBOUNCE_MS = 700;

type PendingAdd = { item: NewCartItem; quantity: number; at: number };

function readLocal(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeLocal(key: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage full / disabled — the cart still works, it just isn't durable */
  }
}

/**
 * What identifies a cart for the purpose of "is this worth saving again".
 *
 * Keys and quantities only, deliberately. The other fields are a display snapshot taken when the
 * line was added, and a catalog rename would otherwise trigger a write on every page load for
 * every customer holding that product. Prices are display-only here in any case — checkout
 * repriced from the catalog long before any money moves.
 */
function cartSignature(items: CartItem[]): string {
  return items.map((i) => `${i.key}:${i.quantity}`).join("|");
}

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
  /**
   * Whether the persisted cart has been loaded yet.
   *
   * Exposed because the cart starts EMPTY on every render and only fills in an effect — so an
   * empty `items` before this flips means "not loaded", not "no items". Anything that acts on the
   * cart's contents rather than merely displaying them has to wait for it, or it acts on the empty
   * placeholder. `ClearCart` is the cautionary tale: it ran its clear before the provider hydrated,
   * and the hydration that followed put the cart straight back.
   */
  hydrated: boolean;
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

  // The current lines, readable from an effect that must not re-run when they change — the sync
  // below needs to post what the cart holds without restarting every time the customer edits it.
  const itemsRef = useRef<CartItem[]>(items);

  // Persist on change (once hydrated so we never clobber storage with the empty initial state).
  useEffect(() => {
    itemsRef.current = items;
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

  // ── Durable copy, for signed-in customers ──────────────────────────────────────────────────
  // The owner token the server last issued. "" means "not synced, or signed out" — and is what
  // makes every write below a no-op for a guest, whose cart stays purely local.
  const owner = useRef("");
  // Signature of the cart the server is known to hold, so an unchanged cart is never re-saved.
  const savedSignature = useRef<string | null>(null);
  // Bumped by every local change, so the sync can tell whether its answer is still current by the
  // time it arrives. Without it, a slow round trip would overwrite an item added while it was in
  // flight — the customer would watch their click undo itself.
  const revision = useRef(0);
  const [synced, setSynced] = useState(false);

  /**
   * Whether it is worth asking the server about this cart at all.
   *
   * Re-read on every navigation, from cookies and localStorage only — no network. Two jobs:
   *
   *   1. It keeps a guest's browsing free. Without it every page load on the storefront would post
   *      a Server Action to be told "you're not signed in", on ~130 routes that are otherwise
   *      static and cost nothing.
   *
   *   2. It is what makes signing in restore the cart WITHOUT a reload. Login redirects through a
   *      client-side navigation, so this provider is never remounted and a one-shot sync on mount
   *      would not fire — the customer would sign in, see an empty cart, and have to press refresh.
   *      `pathname` in the deps catches the transition; the sync effect below re-runs on the flip.
   *
   * The owner token is ORed in because it means this browser has synced as a signed-in customer
   * before: that covers the case where the hint cookie has drifted away from a session that is
   * still perfectly valid (see customer-hint.ts), which is exactly the customer whose cart most
   * needs restoring. A hint that is missing on BOTH counts costs one page load — `/api/session`
   * repairs it, and the next navigation syncs.
   */
  const pathname = usePathname();
  const [maybeSignedIn, setMaybeSignedIn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookies and localStorage are unreadable during SSR, so this cannot be initial state
    setMaybeSignedIn(hasCustomerSessionHint() || readLocal(OWNER_KEY) !== "");
  }, [pathname]);

  // Reconcile with the stored cart, after hydration and again if the visitor signs in. The hint is
  // only a trigger and is never trusted: the action re-reads the signed session and answers
  // `signedIn: false` for anyone forging it, at which point nothing here happens.
  useEffect(() => {
    if (!hydrated || !maybeSignedIn) return;
    let cancelled = false;
    const at = revision.current;

    void syncCartAction({
      items: itemsRef.current,
      owner: readLocal(OWNER_KEY),
      dirty: readLocal(DIRTY_KEY) === "1",
    })
      .then((result) => {
        if (cancelled || !result.signedIn) return;
        owner.current = result.owner;
        writeLocal(OWNER_KEY, result.owner);

        // A change landed while this was in flight, so the answer is already out of date. Keep
        // what the customer did — and leave the cart marked unsaved, so the save effect below is
        // guaranteed to push the newer state up rather than mistaking the server's stale copy for
        // agreement. This is the path a checkout takes: `ClearCart` empties the cart while this
        // request is still open, and without the null the emptied cart could be left holding the
        // pre-checkout lines the sync had just re-saved.
        if (revision.current !== at) {
          savedSignature.current = null;
          return;
        }

        // The server has just written exactly this, so it is clean by definition.
        savedSignature.current = cartSignature(result.items);
        writeLocal(DIRTY_KEY, "");
        setItems(result.items);
      })
      // Offline, or Firestore down. The local cart is untouched and still works — which is the
      // entire reason localStorage remains the working copy.
      .catch((err) => console.error("[cart] could not sync:", err))
      .finally(() => {
        if (!cancelled) setSynced(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, maybeSignedIn]);

  // Push local changes up, debounced. Marks the cart dirty SYNCHRONOUSLY and clears that only on a
  // confirmed save, so a tab closed inside the debounce window is recoverable — see DIRTY_KEY.
  useEffect(() => {
    if (!hydrated || !synced || !owner.current) return;

    const signature = cartSignature(items);
    if (signature === savedSignature.current) return;

    writeLocal(DIRTY_KEY, "1");
    const snapshot = items;
    const token = owner.current;

    const timer = setTimeout(() => {
      void saveCartAction({ items: snapshot, owner: token })
        .then((result) => {
          if (!result.saved) return;
          savedSignature.current = signature;
          // Only clear the flag if nothing has changed since — otherwise a change made during the
          // save would be marked clean without ever having been sent.
          if (cartSignature(itemsRef.current) === signature) writeLocal(DIRTY_KEY, "");
        })
        .catch((err) => console.error("[cart] could not save:", err));
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [items, hydrated, synced]);

  const [authPrompt, setAuthPrompt] = useState<AuthPromptReason | null>(null);

  /**
   * The unconditional add. Everything that actually puts a line in the cart goes through here, so
   * the gate in `addItem` below can't be sidestepped by a caller that "just needs to add one".
   */
  const commitAdd = useCallback((item: NewCartItem, quantity: number) => {
    const qty = clampQuantity(quantity);
    revision.current += 1;
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
    revision.current += 1;
    setItems((prev) =>
      // Stepping below 1 removes the line; anything else is clamped to a whole, in-range quantity.
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity: clampQuantity(quantity) } : i)),
    );
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((key) => {
    revision.current += 1;
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => {
    revision.current += 1;
    setItems([]);
  }, []);

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
    hydrated,
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
