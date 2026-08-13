"use server";

/**
 * Public storefront mutations: placing an order, sending a sales inquiry.
 *
 * SECURITY: unlike the admin actions these are deliberately unauthenticated — anyone can order or
 * ask a question. That makes them the only endpoints in the app a stranger can write Firestore
 * through, so everything crossing this boundary is treated as hostile:
 *
 *   - prices are re-read from the catalog, never taken from the request (see reprice below)
 *   - the shipping fee is QUOTED server-side from that repriced subtotal, never posted
 *   - the amount charged is asserted to equal the sum of the line items before the gateway is called
 *   - the product an inquiry names is resolved server-side, so the query string can't invent one
 *   - every free-text field is length-capped, so a document can't be bloated from outside
 *   - a honeypot field absorbs the simplest bots
 *
 * There is no IP rate limiting; it needs a shared store this app doesn't have yet. Worth adding if
 * spam shows up — note that each submission now also costs a PayMongo API call, though spam lands
 * in `awaiting_payment`, which the admin's default view hides.
 *
 * DUPLICATE ORDERS, considered and accepted: a customer who abandons order A and checks out again
 * gets order B, and A is left alone — still awaiting payment, session still live, until its own
 * window lapses or staff cancel it. Expiring A when B is created would be tidier, but the customer
 * may have A open in another tab and be mid-payment, and killing a live payment to clean up an
 * order list is the wrong trade. The resume notice on /checkout is the mitigation.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import {
  createOrder,
  getOrder,
  setOrderCheckoutSession,
  setOrderPaymentError,
  type JrsShipment,
  type OrderLine,
} from "@/lib/orders";
import { createInquiry, type InquiryProduct } from "@/lib/inquiries";
import { getAllProducts } from "@/lib/catalog";
import { getBrandBySlug } from "@/lib/content";
import { brandProductHref, brandProductSlugify, productImageUrl } from "@/lib/products";
import { parseDescription } from "@/lib/product-description";
import { clampQuantity } from "@/lib/cart-item";
import {
  createCheckoutSession,
  isPayMongoConfigured,
  toCentavos,
  type PayMongoLineItem,
} from "@/lib/paymongo";
import {
  chargeForShipping,
  SHIPPING_LINE_DESCRIPTION,
  SHIPPING_LINE_NAME,
} from "@/lib/shipping";
import { getJrsRate, JrsError, RATE_ORIGIN } from "@/lib/jrs";
import { getBarangays, getCities, isKnownLocation } from "@/lib/locations";
import { buildParcel, toParcelItem, type ParcelItem } from "@/lib/jrs-packaging";
import { PAYMENT_METHOD_TYPES } from "@/lib/payment-methods";
import {
  isOrderId,
  isPayWindowOpen,
  parsePendingPayment,
  PAY_COOKIE,
  PAY_COOKIE_MAX_AGE,
  serializePendingPayment,
  type PendingPayment,
} from "@/lib/pay-window";
import { SITE, SITE_URL } from "@/lib/constants";
import { cappedText, text, type ActionState } from "@/lib/form-data";

/** Field caps. Generous for a real customer, small enough that abuse can't bloat a document. */
const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_PHONE = 40;
const MAX_MESSAGE = 2000;
const MAX_ADDRESS_FIELD = 200;
/** More lines than any genuine clinic order, and a hard ceiling on repricing work per request. */
const MAX_LINES = 50;
/** Conservative house cap on the blurb sent to PayMongo — not a documented gateway limit. */
const MAX_LINE_DESCRIPTION = 255;
/** Firestore auto-ids are 20 chars; the cap is just the usual boundary discipline. */
const MAX_ORDER_ID = 64;

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
 * A repriced line plus the blurb PayMongo shows beside it on the hosted page.
 *
 * The description is TRANSIENT — it goes to the gateway and is thrown away. It isn't part of what
 * was charged, it can be re-read from the catalog at any time, and persisting it would mean
 * widening OrderLine, toOrderLine() and every stored document for a string no admin screen renders.
 *
 * `parcel` is transient for the same reason: it goes to JRS and what comes back is what we keep.
 * `undefined` means this product has no dimensions recorded — see `buildParcel`.
 */
type PricedLine = { line: OrderLine; description: string; parcel: ParcelItem | undefined };

/**
 * The one-line blurb for a product, for the gateway only.
 *
 * `summary` first, then the first real paragraph of the description. That falls through
 * `parseDescription()` rather than taking `description[0]` naively: most brand copy was pasted in
 * with literal "Description:" labels and a first line repeating the product name, so the raw first
 * element is frequently the string "Description:" or a duplicate of the title — which would then
 * be what a paying customer reads on PayMongo's page.
 */
function lineDescription(
  summary: string | undefined,
  description: string[] | undefined,
  name: string,
): string {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, MAX_LINE_DESCRIPTION);

  const fromSummary = clean(summary ?? "");
  if (fromSummary) return fromSummary;

  const paragraph = parseDescription(description, name).find((b) => b.type === "paragraph");
  return paragraph ? clean(paragraph.text) : "";
}

/**
 * Rebuild every line from the catalog.
 *
 * The cart snapshots prices in localStorage and can sit there for weeks, so the figure the browser
 * sends may be stale — or simply edited. `cart.tsx` spells this out: never charge the client's
 * subtotal. Lines whose product has since been deleted are dropped rather than guessed at.
 */
async function reprice(posted: PostedLine[]): Promise<PricedLine[]> {
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

  const lines: PricedLine[] = [];

  for (const line of posted) {
    const id = typeof line.id === "string" ? line.id : "";
    if (!id) continue;
    const quantity = clampQuantity(Number(line.quantity));

    if (line.source === "catalog") {
      const product = catalog.find((p) => p.slug === id);
      if (!product) continue;
      lines.push({
        line: {
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
        },
        description: lineDescription(product.summary, product.description, product.name),
        // The seeded catalog carries no dimensions and has no admin UI to add them, so every
        // catalog line is unmeasured and folds into the fallback parcel in `buildParcel`.
        parcel: undefined,
      });
      continue;
    }

    if (line.source === "brand") {
      const brand = brands.get(brandSlugFromHref(line.href));
      const product = brand?.products.find((p) => p.id === id);
      // Products priced on request have no price to charge — they go through an inquiry instead.
      if (!brand || !product || product.contactSales) continue;
      lines.push({
        line: {
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
        },
        description: lineDescription(product.summary, product.description, product.name),
        // Dimensions are optional on a brand product, and `toParcelItem` demands all four. It also
        // copies ONLY those four — spreading the product would ship its gallery to the courier.
        parcel: toParcelItem(product),
      });
    }
  }

  return lines;
}

/** "City, Province" — what JRS rates a destination by. */
function recipientLine(shipping: { city: string; region: string }): string {
  return [shipping.city, shipping.region].filter(Boolean).join(", ");
}

/**
 * Quote this cart to this address, and return the snapshot to freeze on the order.
 *
 * Retries ONCE on a transient failure — a timeout or a 5xx, never a 4xx, which means the request or
 * the key is wrong and will fail identically a second later. Checkout blocks when a rate can't be
 * had, so one retry is the difference between a blip and a customer who can't buy anything; two
 * would just make them wait 30 seconds to be told the same thing.
 */
async function quoteJrs(
  priced: PricedLine[],
  shipping: { city: string; region: string },
): Promise<JrsShipment> {
  const { shipmentItems, packagingName } = buildParcel(
    priced.map(({ line, parcel }) => ({ price: line.price, quantity: line.quantity, parcel })),
  );
  const recipient = recipientLine(shipping);
  const request = { recipient, shipmentItems, packagingName };

  let rate;
  try {
    rate = await getJrsRate(request);
  } catch (err) {
    if (!(err instanceof JrsError) || !err.transient) throw err;
    console.warn("[shipping] JRS rate failed, retrying once:", err.message);
    rate = await getJrsRate(request);
  }

  return {
    packagingName: packagingName ?? null,
    shipmentItems,
    shipperAddressLine1: RATE_ORIGIN,
    recipientAddressLine1: recipient,
    express: false,
    insurance: true,
    valuation: true,
    codAmountToCollect: 0,
    shippingCost: rate.shippingCost,
    insuranceCost: rate.insuranceCost,
    valuationCost: rate.valuationCost,
    quotedAt: Date.now(),
    rawResponse: rate.rawResponse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Address dropdowns
//
// Served from the committed PSGC snapshot in `data/ph-locations.json` — see `src/lib/locations.ts`.
// Picking from a list rather than typing free text is what stops the spelling variants JRS has to
// string-match against; it is not a promise that JRS delivers there, which only `getrate` can make.
//
// Server Actions rather than props: the barangay set is 42,046 entries and has no business in a
// browser bundle. Only the selected city's few dozen ever cross the wire.
// ─────────────────────────────────────────────────────────────────────────────

const toOptions = (names: string[]) => names.map((name) => ({ value: name, label: name }));

export async function listCitiesAction(province: string): Promise<SelectOption[]> {
  return toOptions(getCities(String(province ?? "").slice(0, MAX_ADDRESS_FIELD)));
}

export async function listBarangaysAction(
  province: string,
  city: string,
): Promise<SelectOption[]> {
  return toOptions(
    getBarangays(
      String(province ?? "").slice(0, MAX_ADDRESS_FIELD),
      String(city ?? "").slice(0, MAX_ADDRESS_FIELD),
    ),
  );
}

/** Provinces are rendered on the server into the checkout page, so there's no action for them. */
export type SelectOption = { value: string; label: string };

/**
 * What the checkout panel shows in its Shipping row.
 *
 * Only two outcomes on purpose. There is no "we'll work it out later" state: delivery is priced
 * before the customer pays or the order doesn't happen, so anything that isn't a quote is an error
 * the customer is asked to retry.
 */
export type ShippingQuote =
  | { status: "quoted"; shippingFee: number; jrsCost: number; packagingName: string | null }
  | { status: "error" };

/**
 * Price delivery for the checkout summary, before anything is submitted.
 *
 * Called directly from the client as the customer fills in their city and province — the checkout
 * form is uncontrolled and there is no address to quote against until they type one. The figure is
 * ADVISORY: `placeOrderAction` re-quotes from the repriced cart and the submitted address, and that
 * is what's charged. This exists so the total isn't a surprise, not to decide it.
 *
 * SECURITY: unauthenticated, like everything else in this file, and it spends a paid courier call
 * per invocation. `reprice()` caps the work at MAX_LINES and the client debounces, but there is no
 * rate limiting here any more than there is on `placeOrderAction` — see the note at the top.
 */
export async function quoteShippingAction(input: {
  lines: string;
  city: string;
  region: string;
}): Promise<ShippingQuote> {
  const city = String(input.city ?? "").slice(0, MAX_ADDRESS_FIELD).trim();
  const region = String(input.region ?? "").slice(0, MAX_ADDRESS_FIELD).trim();
  if (!city || !region) return { status: "error" };

  try {
    const priced = await reprice(parsePostedLines(String(input.lines ?? "")));
    if (priced.length === 0) return { status: "error" };

    const subtotal = priced.reduce((sum, p) => sum + p.line.lineTotal, 0);
    const shipment = await quoteJrs(priced, { city, region });

    return {
      status: "quoted",
      shippingFee: chargeForShipping(shipment.shippingCost, subtotal),
      jrsCost: shipment.shippingCost,
      packagingName: shipment.packagingName,
    };
  } catch (err) {
    // Never surfaced to the customer verbatim — JRS's wording is for our logs only.
    console.error("[shipping] could not quote:", err);
    return { status: "error" };
  }
}

/**
 * Absolute origin for the URLs PayMongo sends the customer back to.
 *
 * Prefers the request's Host in local development so a developer's test payment returns to their
 * own machine — without this, SITE_URL falls back to the production domain whenever
 * NEXT_PUBLIC_SITE_URL is empty (as it is in .env.local), and a local test payment would bounce
 * the developer to the live site.
 *
 * Everywhere else SITE_URL wins, because Host is client-controlled: an attacker could otherwise
 * set it to their own domain and have PayMongo return a paying customer there. Low impact —
 * success_url is not proof of payment, see checkout/confirmed/page.tsx — but there is no reason
 * to allow it.
 */
async function requestOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return SITE_URL;
}

/**
 * PayMongo renders line-item images from its own servers, so a relative path is useless there.
 * Catalog images are absolute (picsum) and admin uploads are absolute (Firebase Storage), but a
 * brand product with no image of its own falls back to `brand.logo`, which for the seeded brands
 * is a repo-relative path like "/brand-logos/kerr.webp".
 *
 * Cosmetic only — an unreachable image simply doesn't render on the hosted page.
 */
function absoluteImage(src: string, origin: string): string | undefined {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${origin}${src}`;
  return undefined;
}

/**
 * Point the browser at the payment the customer still owes.
 *
 * `httpOnly: false` deliberately — the site-wide resume banner reads this with `document.cookie`,
 * which is what keeps the storefront layout free of `cookies()` and therefore keeps ~130 routes
 * prerendered. See `pay-window.ts` for the full reasoning; the short version is that the cookie
 * grants nothing, because `/checkout/pay` re-derives every decision from the order document.
 *
 * `sameSite: "lax"` is REQUIRED, not merely conventional: the customer comes back from PayMongo
 * via a cross-site top-level navigation, and `strict` would withhold the cookie on exactly that
 * request — so the resume notice would vanish the moment it is most needed.
 */
async function setPendingPayment(pending: PendingPayment): Promise<void> {
  (await cookies()).set(PAY_COOKIE, serializePendingPayment(pending), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PAY_COOKIE_MAX_AGE,
  });
}

async function clearPendingPayment(): Promise<void> {
  (await cookies()).delete(PAY_COOKIE);
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
  // The form offers only real province/city pairs, but a Server Action is a public endpoint and
  // these arrive as plain strings. Caught here rather than at `getrate`, where the failure would
  // read as a courier problem instead of an address the customer can fix.
  if (!isKnownLocation(shipping.region, shipping.city)) {
    return {
      error: "We couldn't find that city. Please pick your province and city from the lists.",
    };
  }

  // Assigned inside the try, used after it — `redirect()` throws a NEXT_REDIRECT control-flow
  // error, so calling it inside would let the catch swallow a *successful* checkout and show the
  // customer an error.
  let destination: string;
  // Tracked so a gateway failure can be recorded against the order the customer already has.
  let orderId = "";

  try {
    const priced = await reprice(parsePostedLines(text(form, "lines")));
    if (priced.length === 0) {
      return { error: "Your cart is empty, or those products are no longer available." };
    }

    const lines = priced.map((p) => p.line);
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    // Quoted server-side from the REPRICED cart and the address on THIS form. The browser never
    // posts a shipping fee, and whatever the summary panel displayed is not consulted.
    //
    // UNCONDITIONAL, and deliberately BEFORE createOrder. Delivery is priced before the customer
    // reaches the gateway or the order doesn't happen: there is no path here that records an order
    // with shipping "to be arranged", because the next thing that happens is a payment for a total
    // that would then be wrong. A courier we can't reach throws, and leaves no half-formed order.
    //
    // `jrsShipment` is frozen onto the document so the shipment can be booked later without asking
    // for a second rate — see orders.ts.
    const jrsShipment = await quoteJrs(priced, shipping);
    const shippingFee = chargeForShipping(jrsShipment.shippingCost, subtotal);
    const total = subtotal + shippingFee;

    // The order is written BEFORE the customer goes anywhere near the gateway, so an abandoned
    // payment still leaves us what they typed, and every session maps to a real record.
    const created = await createOrder({
      customer,
      shipping,
      lines,
      subtotal,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      shippingFee,
      total,
      jrsShipment,
    });
    orderId = created.id;

    if (!isPayMongoConfigured()) {
      // The pre-PayMongo behaviour, which .env.example promises still works with empty keys:
      // record the order and let the team arrange payment. There is nothing to resume, and a
      // pointer left over from a previous order must not survive into this one.
      await clearPendingPayment();
      destination = `/checkout/confirmed?ref=${encodeURIComponent(created.ref)}`;
    } else {
      const origin = await requestOrigin();
      const session = await createCheckoutSession(
        buildSessionInput({ priced, shippingFee, total, customer, shipping, created, origin }),
      );
      await setOrderCheckoutSession(created.id, session.id, session.checkoutUrl);
      await setPendingPayment({
        orderId: created.id,
        ref: created.ref,
        exp: created.checkoutExpiresAt,
      });
      // The interstitial, not PayMongo — the customer gets a page they can come back to.
      destination = "/checkout/pay";
    }

    // "layout" rather than "page" so the sidebar's order badge recounts too.
    revalidatePath("/admin/orders", "layout");
  } catch (err) {
    // The order stays — it's the record of what the customer wanted, and it sits in
    // `awaiting_payment`, which the admin's default view hides. `paymentError` is how staff
    // diagnose it if someone calls. PayMongo's own wording never reaches the customer.
    //
    // The pending-payment cookie is deliberately NOT cleared here: if this order failed to get a
    // session, a previous order's session may still be live and payable, and dropping its pointer
    // would strand a payment the customer could still complete.
    console.error("[checkout] could not start payment:", err);

    // A courier failure is its own thing and happens BEFORE any order is written, so `orderId` is
    // still empty and there is nothing to annotate. Blocking is the deliberate choice: shipping
    // this order at an unknown cost, or free, is worse than asking the customer to try again.
    if (err instanceof JrsError) {
      return {
        error:
          "We couldn't calculate shipping for your delivery address. Please check your city and " +
          "province and try again in a moment.",
      };
    }

    if (orderId) await setOrderPaymentError(orderId, String(err)).catch(() => {});
    return {
      error: isPayMongoConfigured()
        ? "We couldn't start your payment. Please try again in a moment."
        : "Could not place your order. Please try again.",
    };
  }

  redirect(destination);
}

/**
 * Hand the customer over to PayMongo — the button on `/checkout/pay`.
 *
 * A Server Action rather than a plain `<a href={order.checkoutUrl}>`, because a link cannot
 * re-validate and the stale tab is exactly the case an interstitial exists to handle: a page left
 * open for two hours, then clicked, landing the customer on PayMongo's own error screen — or worse
 * on a session we have already told them was dead. This re-reads the order at click time and, when
 * anything has moved, bounces back to `/checkout/pay`, which renders whatever the truth turns out
 * to be.
 *
 * `failed` is deliberately NOT excluded: PayMongo's hosted page lets a customer pick another
 * method after a decline, and `applyOrderPayment` documents `failed → paid` as legal for exactly
 * that reason. Sending them back to build a duplicate order instead would waste the point of
 * offering five payment methods.
 *
 * The `?o=` on the failure path is the same exposure `/checkout/confirmed?o=` already accepts —
 * and knowing an order id already gets you this far, so accepting a posted one adds nothing.
 */
export async function continueToPaymentAction(form: FormData): Promise<void> {
  const posted = cappedText(form, "o", MAX_ORDER_ID);
  const cookie = parsePendingPayment((await cookies()).get(PAY_COOKIE)?.value);
  const orderId = (isOrderId(posted) && posted) || cookie?.orderId || "";

  // Default is the interstitial, so every failure mode lands on a page that explains itself.
  let destination = orderId
    ? `/checkout/pay?o=${encodeURIComponent(orderId)}`
    : "/checkout/pay";

  if (orderId) {
    const order = await getOrder(orderId).catch(() => undefined);
    if (
      order &&
      order.checkoutUrl &&
      order.paymentStatus !== "paid" &&
      order.paymentStatus !== "expired" &&
      isPayWindowOpen(order.checkoutExpiresAt)
    ) {
      destination = order.checkoutUrl;
    }
  }

  redirect(destination);
}

/**
 * Everything PayMongo needs to render and charge this order.
 *
 * Split out of the action purely to keep the flow above readable — it has no logic of its own
 * beyond the total assertion.
 */
function buildSessionInput(args: {
  priced: PricedLine[];
  shippingFee: number;
  total: number;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shipping: {
    address: string;
    apartment: string;
    barangay: string;
    city: string;
    region: string;
    postal: string;
  };
  created: { id: string; ref: string };
  origin: string;
}) {
  const { priced, shippingFee, total, customer, shipping, created, origin } = args;

  const lineItems: PayMongoLineItem[] = priced.map(({ line, description }) => {
    const image = absoluteImage(line.image, origin);
    return {
      name: line.name.slice(0, 255),
      quantity: line.quantity,
      amount: toCentavos(line.price),
      currency: "PHP",
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    };
  });

  // A Checkout Session has no shipping field — PayMongo charges the sum of the line items, so a
  // fee that isn't a line item simply isn't collected.
  if (shippingFee > 0) {
    lineItems.push({
      name: SHIPPING_LINE_NAME,
      quantity: 1,
      amount: toCentavos(shippingFee),
      currency: "PHP",
      description: SHIPPING_LINE_DESCRIPTION,
    });
  }

  // Cheap insurance: catch an arithmetic or rounding regression BEFORE money moves, rather than
  // after a customer has been charged an amount that doesn't match their order.
  const charged = lineItems.reduce((sum, i) => sum + i.amount * i.quantity, 0);
  if (charged !== toCentavos(total)) {
    throw new Error(`Line items sum to ${charged} centavos but the order total is ${toCentavos(total)}.`);
  }

  return {
    lineItems,
    paymentMethodTypes: [...PAYMENT_METHOD_TYPES],
    // `o` is the Firestore document id — ~119 bits, unlike the 6-character ref, so the
    // confirmation page can safely look the order up by it. See confirmed/page.tsx.
    successUrl: `${origin}/checkout/confirmed?ref=${encodeURIComponent(created.ref)}&o=${encodeURIComponent(created.id)}`,
    cancelUrl: `${origin}/checkout?payment=cancelled`,
    description: `Order ${created.ref} · ${SITE.name}`,
    // Legible in PayMongo's dashboard, and nothing more — payment is never keyed off a ref,
    // because a ref collision is documented as cosmetic and must stay that way.
    referenceNumber: created.ref,
    // Values must be strings; PayMongo rejects numbers and booleans.
    metadata: {
      orderId: created.id,
      ref: created.ref,
      shippingFee: String(shippingFee),
      total: String(total),
    },
    // No `sendEmailReceipt` — receipts will come from our own email stack, under our branding,
    // rather than PayMongo's. Until that ships the confirmation page is the written record, so
    // don't promise the customer an email there either.
    showDescription: true,
    showLineItems: true,
    billing: {
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      email: customer.email,
      phone: customer.phone,
      address: {
        line1: shipping.address,
        // PayMongo has no barangay field; folding it in keeps it on the receipt.
        line2: [shipping.apartment, shipping.barangay].filter(Boolean).join(", "),
        city: shipping.city,
        state: shipping.region,
        postal_code: shipping.postal,
        // ISO-3166 alpha-2. The order stores the literal "Philippines"; sending that is a 400.
        country: "PH",
      },
    },
  };
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
