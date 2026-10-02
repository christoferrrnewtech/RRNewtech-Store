/**
 * Client-side analytics — one place to fire ecommerce conversion events.
 *
 * Every function no-ops safely when a tag isn't configured (no Pixel/GA ID) or during SSR,
 * so the keyless build and local dev stay clean. Both Meta Pixel and GA4 are fired from here;
 * add Google Ads / TikTok / etc. in this single file so callers never change.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type Fbq = (
  command: string,
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;
type Gtag = (command: string, event: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export type AnalyticsItem = {
  id: string; // SKU or slug
  name: string;
  category: string;
  price: number;
  quantity?: number;
};

/**
 * Client-side route change. Pixel only — GA4's enhanced measurement already records
 * history-based page changes on its own, so sending one here would double-count.
 */
export function trackPageView(): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "PageView");
}

/** Product detail page view. */
export function trackViewItem(item: AnalyticsItem): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    content_category: item.category,
    value: item.price,
    currency: "PHP",
  });
  window.gtag?.("event", "view_item", {
    currency: "PHP",
    value: item.price,
    items: [gaItem(item)],
  });
}

/** Add-to-cart conversion — the key Phase 1 signal for retargeting audiences. */
export function trackAddToCart(item: AnalyticsItem): void {
  if (typeof window === "undefined") return;
  const qty = item.quantity ?? 1;
  const value = item.price * qty;
  window.fbq?.("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value,
    currency: "PHP",
  });
  window.gtag?.("event", "add_to_cart", {
    currency: "PHP",
    value,
    items: [gaItem(item)],
  });
}

/** Checkout page opened with a non-empty cart. `value` is the cart subtotal. */
export function trackInitiateCheckout(items: AnalyticsItem[], value: number): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    content_type: "product",
    num_items: items.reduce((n, i) => n + (i.quantity ?? 1), 0),
    value,
    currency: "PHP",
  });
  window.gtag?.("event", "begin_checkout", {
    currency: "PHP",
    value,
    items: items.map(gaItem),
  });
}

/**
 * Payment confirmed. Callers must fire this ONCE per order — see TrackPurchase, which guards
 * against reloads. `eventID` is a second line of defence: Meta drops a repeat with the same id.
 */
export function trackPurchase(order: { ref: string; value: number; itemCount: number }): void {
  if (typeof window === "undefined") return;
  window.fbq?.(
    "track",
    "Purchase",
    { value: order.value, currency: "PHP", num_items: order.itemCount },
    { eventID: `purchase-${order.ref}` },
  );
  window.gtag?.("event", "purchase", {
    transaction_id: order.ref,
    currency: "PHP",
    value: order.value,
  });
}

/**
 * Quote request submitted — the B2B conversion, since equipment rarely goes through the cart.
 * Fired from /request-quote/thank-you; `ref` is the inquiry reference, used as the Pixel eventID so
 * Meta drops a repeat if the page is reloaded past TrackInquiry's guard.
 */
export function trackLead(ref: string): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "Lead", { content_category: "quote" }, { eventID: `lead-${ref}` });
  window.gtag?.("event", "generate_lead", { lead_source: "quote" });
}

/**
 * Contact form submitted, from /contact/thank-you. `source` separates a general message from an
 * "Ask about this product" inquiry, which is the one worth bidding on. `ref` as in trackLead.
 */
export function trackContact(ref: string, source: "contact" | "product"): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "Contact", { content_category: source }, { eventID: `contact-${ref}` });
  window.gtag?.("event", "contact", { contact_source: source });
}

function gaItem(item: AnalyticsItem) {
  return {
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity ?? 1,
  };
}
