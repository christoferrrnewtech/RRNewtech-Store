/**
 * Client-side analytics — one place to fire ecommerce conversion events.
 *
 * Every function no-ops safely when a tag isn't configured (no Pixel/GA ID) or during SSR,
 * so the keyless build and local dev stay clean. Both Meta Pixel and GA4 are fired from here;
 * add Google Ads / TikTok / etc. in this single file so callers never change.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type Fbq = (command: string, event: string, params?: Record<string, unknown>) => void;
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

function gaItem(item: AnalyticsItem) {
  return {
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity ?? 1,
  };
}
