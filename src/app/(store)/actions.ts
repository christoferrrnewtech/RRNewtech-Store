"use server";

/**
 * Public storefront mutations: placing an order, sending a sales inquiry.
 *
 * SECURITY: unlike the admin actions these are deliberately unauthenticated — anyone can order or
 * ask a question. That makes them the only endpoints in the app a stranger can write Firestore
 * through, so everything crossing this boundary is treated as hostile:
 *
 *   - prices are re-read from the catalog, never taken from the request (see reprice below)
 *   - the product an inquiry names is resolved server-side, so the query string can't invent one
 *   - every free-text field is length-capped, so a document can't be bloated from outside
 *   - a honeypot field absorbs the simplest bots
 *
 * There is no IP rate limiting; it needs a shared store this app doesn't have yet. Worth adding if
 * spam shows up.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOrder, type OrderLine } from "@/lib/orders";
import { createInquiry, type InquiryProduct } from "@/lib/inquiries";
import { getAllProducts } from "@/lib/catalog";
import { getBrandBySlug } from "@/lib/content";
import { brandProductHref, brandProductSlugify, productImageUrl } from "@/lib/products";
import { clampQuantity } from "@/lib/cart-item";
import { cappedText, text, type ActionState } from "@/lib/form-data";

/** Field caps. Generous for a real customer, small enough that abuse can't bloat a document. */
const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_PHONE = 40;
const MAX_MESSAGE = 2000;
const MAX_ADDRESS_FIELD = 200;
/** More lines than any genuine clinic order, and a hard ceiling on repricing work per request. */
const MAX_LINES = 50;

/**
 * A bot filling every field it finds trips this; a real customer never sees it. Returning success
 * without writing is deliberate — telling a bot it failed just teaches it to try again.
 */
function isBot(form: FormData): boolean {
  return text(form, "company").length > 0;
}

/** Good enough to catch typos and obvious junk. Real deliverability is proven by replying. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the browser posts per line. Only these three matter, and even they are re-checked:
 * `href` is read solely to recover which brand a brand line belongs to, since a cart line stores
 * the product id but not the brand (see `brandCartItem` in cart-item.ts).
 */
type PostedLine = { source?: unknown; id?: unknown; quantity?: unknown; href?: unknown };

function parsePostedLines(raw: string): PostedLine[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.slice(0, MAX_LINES) as PostedLine[]) : [];
  } catch {
    return [];
  }
}

/** `/brands/<brandSlug>/<productSlug>` → `brandSlug`, or "" for anything else. */
function brandSlugFromHref(href: unknown): string {
  if (typeof href !== "string") return "";
  const match = /^\/brands\/([^/]+)\//.exec(href);
  return match ? match[1] : "";
}

/**
 * Rebuild every line from the catalog.
 *
 * The cart snapshots prices in localStorage and can sit there for weeks, so the figure the browser
 * sends may be stale — or simply edited. `cart.tsx` spells this out: never charge the client's
 * subtotal. Lines whose product has since been deleted are dropped rather than guessed at.
 */
async function reprice(posted: PostedLine[]): Promise<OrderLine[]> {
  const catalog = posted.some((l) => l.source === "catalog") ? await getAllProducts() : [];

  // One read per brand rather than per line — a cart usually holds several items from the same one.
  const brandSlugs = new Set(
    posted.filter((l) => l.source === "brand").map((l) => brandSlugFromHref(l.href)).filter(Boolean),
  );
  const brands = new Map(
    (await Promise.all([...brandSlugs].map((slug) => getBrandBySlug(slug))))
      .filter((b) => b !== undefined)
      .map((b) => [b.slug, b]),
  );

  const lines: OrderLine[] = [];

  for (const line of posted) {
    const id = typeof line.id === "string" ? line.id : "";
    if (!id) continue;
    const quantity = clampQuantity(Number(line.quantity));

    if (line.source === "catalog") {
      const product = catalog.find((p) => p.slug === id);
      if (!product) continue;
      lines.push({
        source: "catalog",
        id: product.slug,
        name: product.name,
        sku: product.sku,
        href: `/products/${product.slug}`,
        image: productImageUrl(product),
        unit: product.unit,
        quantity,
        price: product.price,
        lineTotal: product.price * quantity,
      });
      continue;
    }

    if (line.source === "brand") {
      const brand = brands.get(brandSlugFromHref(line.href));
      const product = brand?.products.find((p) => p.id === id);
      // Products priced on request have no price to charge — they go through an inquiry instead.
      if (!brand || !product || product.contactSales) continue;
      lines.push({
        source: "brand",
        id: product.id,
        name: product.name,
        sku: product.id,
        href: brandProductHref(brand.slug, product),
        image: product.image || brand.logo,
        unit: "",
        quantity,
        price: product.price,
        lineTotal: product.price * quantity,
      });
    }
  }

  return lines;
}

export async function placeOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isBot(form)) return { ok: "Order received." };

  const customer = {
    firstName: cappedText(form, "firstName", MAX_NAME),
    lastName: cappedText(form, "lastName", MAX_NAME),
    email: cappedText(form, "email", MAX_EMAIL),
    phone: cappedText(form, "phone", MAX_PHONE),
  };
  const shipping = {
    address: cappedText(form, "address", MAX_ADDRESS_FIELD),
    apartment: cappedText(form, "apartment", MAX_ADDRESS_FIELD),
    barangay: cappedText(form, "barangay", MAX_ADDRESS_FIELD),
    city: cappedText(form, "city", MAX_ADDRESS_FIELD),
    region: cappedText(form, "region", MAX_ADDRESS_FIELD),
    postal: cappedText(form, "postal", MAX_ADDRESS_FIELD),
    country: "Philippines",
  };

  if (!customer.firstName || !customer.lastName) return { error: "Enter your first and last name." };
  if (!looksLikeEmail(customer.email)) return { error: "Enter a valid email address." };
  if (!customer.phone) return { error: "Enter a phone number so we can confirm your order." };
  if (!shipping.address || !shipping.barangay || !shipping.city || !shipping.region || !shipping.postal) {
    return { error: "Complete every required part of your delivery address." };
  }

  let ref: string;
  try {
    const lines = await reprice(parsePostedLines(text(form, "lines")));
    if (lines.length === 0) {
      return { error: "Your cart is empty, or those products are no longer available." };
    }

    const created = await createOrder({
      customer,
      shipping,
      lines,
      subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    });
    ref = created.ref;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not place your order. Please try again.",
    };
  }

  // The admin queue reads this list; nothing on the storefront renders orders.
  revalidatePath("/admin/orders");
  redirect(`/checkout/confirmed?ref=${encodeURIComponent(ref)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inquiries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn `?product=&brand=` into a real product record.
 *
 * Resolved from Firestore rather than trusted, so a hand-edited link can't attach a made-up
 * product name to an inquiry. Unknown slugs simply produce an inquiry with no product attached.
 */
async function resolveProduct(
  brandSlugValue: string,
  productSlug: string,
): Promise<InquiryProduct | undefined> {
  if (!brandSlugValue || !productSlug) return undefined;

  const brand = await getBrandBySlug(brandSlugValue);
  const product = brand?.products.find(
    (p) => (p.slug ?? brandProductSlugify(p.name, p.id)) === productSlug || p.id === productSlug,
  );
  if (!brand || !product) return undefined;

  return {
    brandSlug: brand.slug,
    productSlug,
    name: product.name,
    href: brandProductHref(brand.slug, product),
  };
}

export async function sendInquiryAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isBot(form)) return { ok: "Thanks — we'll get back to you shortly." };

  const name = cappedText(form, "name", MAX_NAME);
  const email = cappedText(form, "email", MAX_EMAIL);
  const phone = cappedText(form, "phone", MAX_PHONE);
  const message = cappedText(form, "message", MAX_MESSAGE);

  if (!name) return { error: "Enter your name." };
  if (!looksLikeEmail(email)) return { error: "Enter a valid email address." };
  if (!message) return { error: "Add a message so we know how to help." };

  try {
    const product = await resolveProduct(text(form, "brand"), text(form, "product"));
    await createInquiry({ name, email, phone, message, product });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not send your message. Please try again.",
    };
  }

  revalidatePath("/admin/inquiries");
  return { ok: "Thanks — we'll get back to you shortly." };
}
