/**
 * JRS Express shipping rates and bookings — SERVER ONLY.
 *
 * This module is the KEY and the NETWORK, nothing else. What the requests look like and how to read
 * the replies lives in `jrs-protocol.ts`, which is pure and importable from a plain script; keeping
 * the two apart is what lets `npm run jrs:rate` exercise the real request body and the real parser
 * rather than a copy of them.
 *
 * The subscription key is read LAZILY, never at module scope, so importing this can't throw and the
 * site still builds with `JRS_API_KEY` empty. Same pattern as `initAdminApp()` in firebase.ts and
 * `secretKey()` in paymongo.ts. It is also why the key can never reach the browser: nothing here is
 * client-safe, and the storefront only ever reaches it through a Server Action.
 *
 * Note that unlike PayMongo, an empty key is not a soft-fail. Checkout BLOCKS without a rate —
 * delivery is priced before the customer reaches the gateway or the order isn't taken.
 */

import "server-only";
import {
  API_URL,
  bookingRequestBody,
  obj,
  parseRate,
  parseWaybill,
  rateRequestBody,
  type JrsBookingRequest,
  type JrsRateRequest,
  type Raw,
} from "@/lib/jrs-protocol";
import type { JrsShipmentItem } from "@/lib/jrs-packaging";

/** A hung courier call would otherwise pin an App Hosting instance until the platform kills it. */
const TIMEOUT_MS = 15_000;

/** Stored raw responses are capped — it's an external string on a document we keep forever. */
const MAX_RAW_RESPONSE = 8_000;

export { PICKUP_ADDRESS, RATE_ORIGIN } from "@/lib/jrs-protocol";
export type { JrsBookingRequest, JrsRateRequest } from "@/lib/jrs-protocol";
export type { JrsShipmentItem } from "@/lib/jrs-packaging";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Whether rates can be quoted at all. Callers branch on this rather than catching a throw. */
export function isJrsConfigured(): boolean {
  return Boolean(process.env.JRS_API_KEY);
}

function apiKey(): string {
  const key = process.env.JRS_API_KEY;
  if (!key) {
    throw new JrsError(
      "JRS_API_KEY is not set — shipping rates are not configured (see .env.example).",
      NOT_CONFIGURED,
    );
  }
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/** Sentinel `status` for "no key configured" — a deployment problem, not a courier one. */
const NOT_CONFIGURED = -1;

/**
 * A courier refusal, a timeout, or a body we couldn't read a rate out of.
 *
 * `status` is the HTTP status, 0 for "never got a response" (network failure or timeout), or
 * {@link NOT_CONFIGURED}. `detail` is JRS's own wording — fine in a server log, but NEVER show it
 * to a customer.
 */
export class JrsError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "JrsError";
    this.status = status;
    this.detail = detail;
  }

  /**
   * Is retrying this immediately worth anything? A timeout or a 5xx may well be transient; a 400 or
   * a 401 means the request is wrong and will fail identically a second later, and an absent key
   * will not appear between two calls a microsecond apart.
   */
  get transient(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JrsRate = {
  shippingCost: number;
  insuranceCost: number;
  valuationCost: number;
  /** JSON-stringified response body, capped. Stored on the order for later diagnosis. */
  rawResponse: string;
};

export type JrsBooking = {
  /** The tracking number, or "" when JRS accepted the booking without returning one. */
  waybillNumber: string;
  rawResponse: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether to log the full request and response bodies.
 *
 * On in development, and switchable on in production with `JRS_DEBUG=1` when a specific order needs
 * chasing. Off in production by DEFAULT because a booking payload carries the customer's name,
 * phone, email and street address, and Cloud Logging would keep all of it far longer than we have
 * any reason to. The one-line summary below is always logged and carries none of that.
 */
function verbose(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.JRS_DEBUG === "1";
}

/**
 * POST one `{ requestType, ...payload }` envelope and hand back whatever parsed out.
 *
 * Returns `parsed: unknown` rather than a coerced object ON PURPOSE: the location endpoints may
 * reasonably answer with a top-level ARRAY, and running that through `obj()` here would silently
 * turn a full province list into `{}`. Each caller narrows it for itself.
 */
async function call(
  url: string,
  requestType: string,
  payload: Raw,
): Promise<{ parsed: unknown; raw: string }> {
  // Read the key FIRST, so an unconfigured deploy fails before it prints a request it never sent.
  const key = apiKey();
  const envelope = { requestType, ...payload };

  if (verbose()) {
    console.log(`[jrs] → ${requestType} ${url}\n` + JSON.stringify(envelope, null, 2));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": key,
      },
      body: JSON.stringify(envelope),
      // A rate must never be served from a cache — it depends on the destination and the parcel.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure or timeout — status 0 distinguishes it from a courier refusal, and marks it
    // as worth one retry.
    throw new JrsError(`Could not reach JRS Express: ${String(err)}`, 0);
  }

  const raw = await response.text();

  // Logged before the status check, so a refusal shows its reason too — that body is usually the
  // only thing that says WHICH field JRS objected to.
  if (verbose()) {
    console.log(`[jrs] ← ${requestType} HTTP ${response.status}\n${raw || "(empty body)"}`);
  }

  if (!response.ok) {
    throw new JrsError(
      `JRS Express returned ${response.status} for ${requestType}.`,
      response.status,
      raw.slice(0, 500),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JrsError(
      `JRS Express returned a non-JSON body for ${requestType}.`,
      response.status,
      raw.slice(0, 500),
    );
  }

  return { parsed, raw: raw.slice(0, MAX_RAW_RESPONSE) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

/** What JRS will charge to carry this parcel. */
export async function getJrsRate(input: JrsRateRequest): Promise<JrsRate> {
  const { parsed, raw } = await call(API_URL, "getrate", {
    apiShippingRequest: rateRequestBody(input),
  });
  const { shippingCost, insuranceCost, valuationCost } = parseRate(obj(parsed));

  // Refusing beats defaulting: a body we can't read must not become free delivery.
  if (shippingCost === undefined) {
    throw new JrsError(
      "JRS Express returned no shipping cost we could read.",
      200,
      raw.slice(0, 500),
    );
  }

  // Always logged, even in production: it is the record of what we charged and why, it carries no
  // customer PII (a city and province, which is all `getrate` is told), and one line per order is
  // a cost worth paying to be able to answer "why was this delivery ₱732?" months later.
  console.log(
    `[jrs] rate ${input.packagingName ?? "General Cargo"} → ${input.recipient} · ` +
      `${input.shipmentItems.length} unit(s), ${totalWeight(input.shipmentItems)}g declared · ` +
      `shipping ${shippingCost} (insurance ${insuranceCost}, valuation ${valuationCost})`,
  );

  return { shippingCost, insuranceCost, valuationCost, rawResponse: raw };
}

/** Declared grams across the parcel — the number that drives JRS's excess charge. */
function totalWeight(items: JrsShipmentItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
}

/**
 * Book the shipment JRS already quoted.
 *
 * `input.shipment` is the snapshot stored on the order at checkout and is replayed VERBATIM — same
 * packaging, same items, same addresses, same flags. Nothing is recalculated and no second rate
 * call is made, so what we book is exactly what the customer was quoted against, however long ago
 * that was and however the product catalog has changed since.
 */
export async function bookJrsShipment(input: JrsBookingRequest): Promise<JrsBooking> {
  const { parsed, raw } = await call(API_URL, "createshipment", {
    apiShippingRequest: bookingRequestBody(input),
  });
  const waybillNumber = parseWaybill(obj(parsed));

  // Order ref and waybill only — the rest of a booking payload is the customer's name, phone and
  // address, which belongs on the order document, not in a log that outlives it.
  console.log(
    `[jrs] booked ${input.reference} · ${input.shipment.packagingName ?? "General Cargo"} · ` +
      `waybill ${waybillNumber || "(none returned)"}`,
  );

  return { waybillNumber, rawResponse: raw };
}
