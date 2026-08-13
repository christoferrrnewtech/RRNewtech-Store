/**
 * PayMongo webhook — the push half of payment confirmation.
 *
 * The only unauthenticated write endpoint in the app that a stranger can reach with a POST, so it
 * is treated exactly as hostile as the storefront actions are:
 *
 *   - the body is read as RAW TEXT before anything parses it, because the HMAC covers the exact
 *     bytes received (see below — this is the single easiest thing to break here)
 *   - the size is capped before hashing, so nobody can make us HMAC a 100 MB body
 *   - the signature is verified with a constant-time compare against a 256-bit secret
 *   - every event is recorded once, keyed by PayMongo's own event id, so a redelivery is free
 *   - the actual state change goes through `applyOrderPayment`, which is transactional and
 *     monotonic, so correctness does not depend on any of the above being perfect
 *
 * NO IP ALLOWLISTING, deliberately: PayMongo publishes no stable source range, so an allowlist
 * would fail silently and totally the day they move infrastructure. The HMAC is the
 * authentication. For the same reason there is no shared secret in the URL — request paths end up
 * in access logs, CDN logs and error reports.
 *
 * This repo has no middleware.ts. If one is ever added for admin auth, `/api/paymongo/*` MUST be
 * excluded from its matcher or every payment will silently stop being confirmed.
 *
 * The customer-facing confirmation page reconciles against PayMongo directly as well, so a
 * misconfigured webhook degrades rather than loses money — see src/lib/payments.ts.
 */

import { revalidatePath } from "next/cache";
import { COLLECTIONS, storeCollection } from "@/lib/firebase";
import {
  applyOrderPayment,
  getOrder,
  getOrderByCheckoutSessionId,
  type Order,
} from "@/lib/orders";
import { getCheckoutSession, isTestMode, verifyWebhookSignature } from "@/lib/paymongo";

// node:crypto and firebase-admin both need the Node runtime, and a payment must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Far more than any real event; small enough that hashing it is never a DoS. */
const MAX_WEBHOOK_BYTES = 128 * 1024;

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Dig the checkout session out of an event payload.
 *
 * PayMongo nests the triggering resource under `data.attributes.data` for `checkout_session.*`
 * events, but the exact depth is thinly documented — so this PROBES the known candidates rather
 * than asserting one shape. Whatever it finds, the handler still has `getCheckoutSession()` to
 * fall back on for the authoritative paid_at and method, so a payload surprise costs one extra API
 * call rather than a lost payment.
 */
function extractSession(body: Raw): {
  sessionId: string;
  orderId: string;
  paidAt: number;
  paymentMethod: string;
} {
  const attributes = obj(obj(body.data).attributes);
  const resource = obj(attributes.data);
  const resourceAttributes = obj(resource.attributes);

  const metadata = obj(resourceAttributes.metadata ?? attributes.metadata);

  const payments = Array.isArray(resourceAttributes.payments) ? resourceAttributes.payments : [];
  const lastPayment = obj(obj(payments[payments.length - 1]).attributes);
  const paidAtSeconds = num(lastPayment.paid_at) || num(resourceAttributes.paid_at);

  return {
    sessionId: str(resource.id),
    orderId: str(metadata.orderId),
    paidAt: paidAtSeconds > 0 ? paidAtSeconds * 1000 : 0,
    paymentMethod:
      str(obj(lastPayment.source).type) || str(lastPayment.payment_method_type) || "",
  };
}

/**
 * Find the order this event is about.
 *
 * `metadata.orderId` first — it is the real Firestore key, an O(1) read with no index, and it is
 * written into the session at creation time, so it resolves even in the sliver of time before
 * `setOrderCheckoutSession` has landed. The session id is the fallback.
 *
 * Never `reference_number`: reference.ts documents a ref collision as cosmetic, and keying payment
 * off it would turn a cosmetic collision into applying a payment to the WRONG order.
 */
async function resolveOrder(orderId: string, sessionId: string): Promise<Order | undefined> {
  const order = (orderId ? await getOrder(orderId) : undefined) ??
    (sessionId ? await getOrderByCheckoutSessionId(sessionId) : undefined);
  if (!order) return undefined;

  // Cross-check, so a forged metadata.orderId (which would need a valid HMAC first) still can't
  // apply someone else's payment to an unrelated order.
  if (sessionId && order.checkoutSessionId && order.checkoutSessionId !== sessionId) {
    console.error(
      `[paymongo] session ${sessionId} does not belong to order ${order.id} — refusing`,
    );
    return undefined;
  }
  return order;
}

/**
 * Record the event, keyed by PayMongo's own id.
 *
 * `.create()` fails ALREADY_EXISTS on a redelivery, which short-circuits the whole handler before
 * a transaction is even opened. Correctness does not depend on this — `applyOrderPayment` is
 * idempotent on its own — but it gives an audit trail of what the gateway actually told us and
 * somewhere to park an orphan for manual reconciliation.
 *
 * Never stores the raw body: it carries the customer's billing name, email and phone.
 */
async function claimEvent(
  eventId: string,
  record: { type: string; sessionId: string; orderId: string },
): Promise<boolean> {
  try {
    await storeCollection(COLLECTIONS.paymentEvents)
      .doc(eventId)
      .create({ ...record, receivedAt: Date.now() });
    return true;
  } catch (err) {
    // gRPC code 6 = ALREADY_EXISTS. Anything else is a real Firestore problem worth surfacing.
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 6) {
      return false;
    }
    throw err;
  }
}

export async function POST(request: Request): Promise<Response> {
  // ── 1. RAW body first. `request.json()` would round-trip through JS objects and re-serialize
  //    with different key ordering and whitespace, and the HMAC is over the bytes as received.
  //    The body can only be read once, so this has to be the first thing that touches it.
  const raw = await request.text();

  // ── 2. Cap before hashing.
  if (raw.length > MAX_WEBHOOK_BYTES) {
    return new Response("Payload too large", { status: 400 });
  }

  // ── 3. Authenticate. Retries of an unsigned request fail identically, so 401 is safe.
  if (!verifyWebhookSignature(raw, request.headers.get("paymongo-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  // ── 4. Parse. After a valid signature this can only fail if something is badly wrong.
  let body: Raw;
  try {
    body = obj(JSON.parse(raw));
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  const eventId = str(obj(body.data).id);
  const eventType = str(obj(obj(body.data).attributes).type);

  // ── 5. Dispatch. Unknown events get a 200: a non-2xx makes PayMongo retry forever and
  //    eventually auto-disable the endpoint, which would take the real events down with it.
  const paidEvent = eventType === "checkout_session.payment.paid" || eventType === "payment.paid";
  const failedEvent = eventType === "payment.failed";
  if (!paidEvent && !failedEvent) {
    console.log(`[paymongo] ignoring event ${eventType || "(none)"}`);
    return new Response("Ignored", { status: 200 });
  }

  try {
    const { sessionId, orderId, paidAt, paymentMethod } = extractSession(body);

    if (!sessionId && !orderId) {
      // Log the shape ONCE so it can be nailed down on the first test payment. Test mode only —
      // a live payload contains the customer's billing details.
      console.error(`[paymongo] could not extract a session from ${eventType}`);
      if (isTestMode()) console.error("[paymongo] raw payload:", raw);
      return new Response("Unrecognised payload", { status: 200 });
    }

    if (eventId && !(await claimEvent(eventId, { type: eventType, sessionId, orderId }))) {
      console.log(`[paymongo] event ${eventId} already applied`);
      return new Response("Duplicate", { status: 200 });
    }

    const order = await resolveOrder(orderId, sessionId);
    if (!order) {
      // 200, not 500: retrying cannot conjure an order into existence, and an endpoint stuck
      // failing is worse than a logged orphan. The event document above is the reconciliation
      // record. Reaching here means a real bug or a session created out of band.
      console.error(`[paymongo] no order for session ${sessionId} / order ${orderId}`);
      return new Response("No matching order", { status: 200 });
    }

    let changed: boolean;
    if (paidEvent) {
      // Read the gateway's own truth when the payload didn't carry it — one extra call per paid
      // order, in exchange for immunity to the payload shape being different than assumed.
      let when = paidAt;
      let method = paymentMethod;
      if (!when || !method) {
        const session = await getCheckoutSession(order.checkoutSessionId || sessionId);
        when = when || session?.paidAt || Date.now();
        method = method || session?.paymentMethod || "";
      }
      changed = await applyOrderPayment(order.id, {
        paymentStatus: "paid",
        paidAt: when,
        paymentMethod: method,
      });
    } else {
      changed = await applyOrderPayment(order.id, { paymentStatus: "failed" });
    }

    if (changed) {
      // "layout" so the sidebar's order badge recounts as well as the list.
      revalidatePath("/admin/orders", "layout");
      console.log(`[paymongo] order ${order.id} → ${paidEvent ? "paid" : "failed"}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    // The one case where PayMongo's retry is exactly what we want.
    console.error("[paymongo] handler failed:", err);
    return new Response("Handler error", { status: 500 });
  }
}
