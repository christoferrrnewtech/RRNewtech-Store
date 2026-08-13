/**
 * PayMongo Checkout Sessions — SERVER ONLY.
 *
 * The only module in the app that knows PayMongo exists. It converts pesos to centavos, speaks
 * PayMongo's `{ data: { attributes } }` envelope, verifies webhook signatures, and hands back
 * plain objects. Everything it reads back is treated as hostile external data and coerced
 * defensively — the same rule `orders.ts` applies to Firestore documents.
 *
 * The secret key is read lazily, never at module scope, because `.env.example` promises the site
 * BUILDS AND RUNS with every PayMongo var empty: checkout then falls back to recording the order
 * and having the team arrange payment, exactly as it did before the gateway existed. Importing
 * this module must therefore never throw. Same lazy pattern as `initAdminApp()` in firebase.ts.
 *
 * API VERSION — v1 throughout, deliberately. PayMongo's create-session doc page renders a `/v2/`
 * prefix, but v2 is a newer addition and v1 remains supported for all three operations, so one
 * base for create, retrieve and expire is simpler than straddling two. Revisit only if v1 is
 * actually deprecated.
 *
 * Docs: https://docs.paymongo.com/reference/checkout-session-resource
 */

import "server-only";
import crypto from "node:crypto";

const API_BASE = "https://api.paymongo.com/v1";

/** A hung gateway call would otherwise pin an App Hosting instance until the platform kills it. */
const TIMEOUT_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Whether payments can be taken at all. Callers branch on this rather than catching a throw. */
export function isPayMongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

/**
 * Derived from the key prefix rather than a separate env var — one fewer thing to get out of
 * sync, and it is the same fact. It decides which component of the webhook signature header
 * (`te` for test, `li` for live) we compare against.
 */
export function isTestMode(): boolean {
  return !process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_");
}

function secretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new PayMongoError(
      "PAYMONGO_SECRET_KEY is not set — payments are not configured (see .env.example).",
      0,
    );
  }
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A gateway refusal. `detail` is PayMongo's own wording — useful in a server log, but NEVER show
 * it to a customer: strings like "amount must be greater than or equal to 10000" leak internals
 * and read as gibberish to anyone who isn't us.
 */
export class PayMongoError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(message: string, status: number, code = "", detail = "") {
    super(message);
    this.name = "PayMongoError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PayMongo takes amounts in centavos as integers. Every catalog price in this store is whole
 * pesos, so the rounding is exact today; it is here so a future decimal price can never send a
 * fractional centavo, which PayMongo rejects outright.
 */
export function toCentavos(pesos: number): number {
  if (!Number.isFinite(pesos)) {
    throw new PayMongoError(`Cannot send a non-finite amount to PayMongo: ${pesos}`, 0);
  }
  return Math.round(pesos * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PayMongoLineItem = {
  name: string;
  quantity: number;
  /** In CENTAVOS — pass through toCentavos(), never a peso figure. */
  amount: number;
  currency: "PHP";
  description?: string;
  /** Absolute URLs only; PayMongo fetches these from its own servers. */
  images?: string[];
};

export type PayMongoBilling = {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postal_code: string;
    /** ISO-3166 alpha-2, e.g. "PH" — NOT "Philippines". */
    country: string;
  };
};

export type CreateCheckoutSessionInput = {
  lineItems: PayMongoLineItem[];
  paymentMethodTypes: string[];
  billing?: PayMongoBilling;
  successUrl: string;
  cancelUrl: string;
  description?: string;
  referenceNumber?: string;
  /** Values must be STRINGS — PayMongo rejects numbers and booleans here. */
  metadata?: Record<string, string>;
  /** Defaults to false — the store sends its own receipts, under its own branding. */
  sendEmailReceipt?: boolean;
  showDescription?: boolean;
  showLineItems?: boolean;
};

export type CheckoutSession = {
  id: string;
  /** "active" | "expired" — the session's own lifecycle, NOT whether it was paid. */
  status: string;
  checkoutUrl: string;
  referenceNumber: string;
  /** Epoch MS of payment (PayMongo reports seconds; converted here); 0 when unpaid. */
  paidAt: number;
  /** Status of the most recent payment attempt ("paid", "failed", …); "" when none exists. */
  paymentStatus: string;
  /** "gcash" | "card" | ""; the method of the most recent payment. */
  paymentMethod: string;
  metadata: Record<string, string>;
};

/** Did this session actually collect money? The question every caller really asks. */
export function isSessionPaid(session: CheckoutSession): boolean {
  return session.paymentStatus === "paid";
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

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

async function call(path: string, init?: { method?: string; body?: unknown }): Promise<Raw> {
  // Secret key as the Basic-auth username with an empty password.
  const auth = Buffer.from(`${secretKey()}:`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      // A payment call must never be served from a cache.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure or timeout — status 0 distinguishes it from a gateway refusal.
    throw new PayMongoError(
      `PayMongo request failed: ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
  }

  const text = await response.text();
  let parsed: Raw = {};
  try {
    parsed = obj(JSON.parse(text));
  } catch {
    // Fall through: a non-JSON body from a 2xx is itself an error worth reporting.
  }

  if (!response.ok) {
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const first = obj(errors[0]);
    throw new PayMongoError(
      `PayMongo ${response.status}: ${str(first.code) || "error"} — ${
        str(first.detail) || text.slice(0, 200)
      }`,
      response.status,
      str(first.code),
      str(first.detail),
    );
  }

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coercion
// ─────────────────────────────────────────────────────────────────────────────

/** PayMongo promises metadata values are strings. Don't take its word for it. */
function toMetadata(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(obj(value))) {
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

/**
 * A session carries an array of payment attempts — absent, empty, or several if the customer
 * retried. The LAST one is the current truth. `paid_at` is in seconds, unlike everything this
 * codebase stores, so it is converted here rather than at each call site.
 */
function toCheckoutSession(data: unknown): CheckoutSession {
  const root = obj(data);
  const attributes = obj(root.attributes);

  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  const lastPayment = obj(obj(payments[payments.length - 1]).attributes);

  const paidAtSeconds = num(lastPayment.paid_at) || num(attributes.paid_at);

  return {
    id: str(root.id),
    status: str(attributes.status),
    checkoutUrl: str(attributes.checkout_url),
    referenceNumber: str(attributes.reference_number),
    paidAt: paidAtSeconds > 0 ? paidAtSeconds * 1000 : 0,
    paymentStatus: str(lastPayment.status),
    paymentMethod: str(lastPayment.source ? obj(lastPayment.source).type : "") ||
      str(lastPayment.payment_method_type),
    metadata: toMetadata(attributes.metadata),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout sessions
// ─────────────────────────────────────────────────────────────────────────────

const CHECKOUT_SESSIONS = "/checkout_sessions";

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSession> {
  const body = {
    data: {
      attributes: {
        line_items: input.lineItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          amount: item.amount,
          currency: item.currency,
          ...(item.description ? { description: item.description } : {}),
          ...(item.images?.length ? { images: item.images } : {}),
        })),
        payment_method_types: input.paymentMethodTypes,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        ...(input.billing ? { billing: input.billing } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.referenceNumber ? { reference_number: input.referenceNumber } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        send_email_receipt: input.sendEmailReceipt ?? false,
        show_description: input.showDescription ?? true,
        show_line_items: input.showLineItems ?? true,
      },
    },
  };

  const result = await call(CHECKOUT_SESSIONS, { method: "POST", body });
  const session = toCheckoutSession(result.data);

  // Without these two the customer cannot be sent anywhere and the order cannot be reconciled.
  if (!session.id || !session.checkoutUrl) {
    throw new PayMongoError("PayMongo returned a session with no id or checkout_url.", 0);
  }
  return session;
}

/** Undefined when PayMongo has never heard of the id — not an error worth throwing over. */
export async function getCheckoutSession(id: string): Promise<CheckoutSession | undefined> {
  if (!id) return undefined;
  try {
    const result = await call(`${CHECKOUT_SESSIONS}/${encodeURIComponent(id)}`);
    return toCheckoutSession(result.data);
  } catch (err) {
    if (err instanceof PayMongoError && err.status === 404) return undefined;
    throw err;
  }
}

/**
 * Stop a session from being payable — used when staff cancel an unpaid order, so a customer can't
 * pay it from a stale tab.
 *
 * Returns a boolean rather than throwing because its documented failures (already expired, has a
 * paid or in-flight payment) are all NORMAL outcomes when cancelling. A cancel button must not
 * fail because the session was already dead.
 */
export async function expireCheckoutSession(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    await call(`${CHECKOUT_SESSIONS}/${encodeURIComponent(id)}/expire`, { method: "POST" });
    return true;
  } catch (err) {
    if (err instanceof PayMongoError && err.status >= 400 && err.status < 500) return false;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signatures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a webhook came from PayMongo.
 *
 * The `Paymongo-Signature` header looks like `t=1700000000,te=<hex>,li=<hex>`: a timestamp, a
 * test-mode signature and a live-mode one. The signed payload is `<t>.<raw request body>`,
 * HMAC-SHA256'd with the webhook's own secret (`whsk_…`, distinct from the API secret key, and
 * distinct again between test and live webhooks).
 *
 * The body must be the EXACT bytes received — see the webhook route, which reads `req.text()`
 * before anything parses it.
 *
 * Returns false rather than throwing on every failure mode (secret unset, header missing or
 * malformed) so a half-configured deploy answers 401 instead of 500-looping.
 *
 * DELIBERATELY NO FRESHNESS WINDOW. Forging a signature requires the 256-bit secret, so the only
 * replay an attacker can mount is re-sending a payload they already captured — and
 * `applyOrderPayment` is idempotent, so that is a no-op. Meanwhile PayMongo's retry-signing
 * behaviour is undocumented (does a retry carry a fresh `t`?), and rejecting on skew would risk
 * dropping a LEGITIMATE retry, i.e. losing a real payment. Skew is logged, never enforced.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  // Split on "," then the FIRST "=" — don't assume the parts arrive in a fixed order.
  const parts = new Map<string, string>();
  for (const part of header.split(",")) {
    const at = part.indexOf("=");
    if (at > 0) parts.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }

  const timestamp = parts.get("t");
  const provided = isTestMode() ? parts.get("te") : parts.get("li");
  if (!timestamp || !provided) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // Length check FIRST — timingSafeEqual throws on a length mismatch. Same guard as auth.ts.
  if (expected.length !== provided.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return false;

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isFinite(skew) && skew > 300) {
    console.warn(`[paymongo] webhook signature is ${Math.round(skew)}s old — accepted anyway`);
  }
  return true;
}
