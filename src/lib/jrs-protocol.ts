/**
 * What JRS Express requests look like and how to read their replies — PURE, no secrets, no network.
 *
 * Split out of `jrs.ts` because none of this needs to be server-only: it is data shape, not access.
 * The transport module keeps the subscription key and the fetch; this keeps the envelope and the
 * parsing. Two things fall out of that, and both are the reason it's worth a second file:
 *
 *   - `scripts/jrs-rate.ts` can exercise the REAL request body and the REAL parser. `server-only`
 *     is supplied by Next's bundler and doesn't resolve under `tsx`, so a script that imported
 *     `jrs.ts` could only ever test a copy of this logic — and a copy of a parser is worth nothing.
 *   - the parser is testable without a network call at all.
 *
 * A CONFIRMED rate response, for reference — flat, PascalCase, no envelope:
 *
 *   { "Id": "1f0bf32f-…", "OriginProvince": "Metro Manila", "OriginMunicipal": "Makati City",
 *     "DestinationProvince": "Metro Manila", "DestinationMunicipal": "Makati City",
 *     "EstimatedDeliveryDate": "2026-08-13T00:35:35Z", "Name": "3 Pounder",
 *     "BaseRate": 238.0, "Insurance": 0.0, "Valuation": 18.0, "Excess": 476.0,
 *     "OtherCharges": 0.0, "TotalShippingRate": 732.0, "Discount": 0.0, "Withholdingtax": null }
 *
 * Two things to take from that. `TotalShippingRate` is the bill and `BaseRate` is NOT — the parser
 * must never fall back to the latter. And `Excess` is real and can dwarf the base, which is why
 * declaring a bigger fallback box doesn't protect us (see FALLBACK_PACKAGING in jrs-packaging.ts).
 *
 * Matching stays case- and separator-insensitive anyway: the booking half of this API is still
 * unseen, and the cost of a spelling mismatch is checkout blocking on every order. A body with no
 * recoverable shipping cost returns `undefined` and the caller throws — an unparsed quote silently
 * becoming free delivery is the one failure worth blocking checkout over.
 */

import type { JrsShipmentItem } from "@/lib/jrs-packaging";

/**
 * Rating and booking are the same Azure API Management function, distinguished by `requestType`.
 *
 * NOTE the `qa-` in the path — this is JRS's QA environment, which is what we were given. Swap it
 * for the production route before taking real money for real deliveries.
 */
export const API_URL =
  "https://jrs-express.azure-api.net/qa-online-shipping-getrate/ShippingRequestFunction";

/**
 * The origin JRS rates FROM, in their documented "City, Province" form.
 *
 * Short on purpose: `getrate` resolves this to a zone, and a full street address is not what that
 * matcher expects. Confirmed working — a rate sent as this came back with
 * `"OriginMunicipal": "Makati City", "OriginProvince": "Metro Manila"`, which is also where the
 * name normalisation in `scripts/sync-locations.ts` gets its target spelling from.
 *
 * The complete pickup address lives in {@link PICKUP_ADDRESS} and is used at booking time, where a
 * courier actually has to find the building.
 */
export const RATE_ORIGIN = "Makati City, Metro Manila";

/** Where a rider collects. Used for booking only — see {@link RATE_ORIGIN}. */
export const PICKUP_ADDRESS =
  "Cityland Herrera Tower, Unit 1207 12th Floor Valero St. Salcedo Village Brgy. Bel-Air, " +
  "Makati City, 1227 Metro Manila";

export type Raw = Record<string, unknown>;

export type JrsRateRequest = {
  /** "City, Province" of the buyer. */
  recipient: string;
  shipmentItems: JrsShipmentItem[];
  /** From `packagingForCart()`. `undefined` omits the field entirely — General Cargo. */
  packagingName: string | undefined;
  /** Cash to collect on delivery. 0 for everything we sell today (PayMongo collects up front). */
  codAmountToCollect?: number;
};

export type JrsBookingRequest = {
  /** The stored quote, replayed verbatim — never re-derived. */
  shipment: {
    packagingName: string | null;
    shipmentItems: JrsShipmentItem[];
    shipperAddressLine1: string;
    recipientAddressLine1: string;
    express: boolean;
    insurance: boolean;
    valuation: boolean;
    codAmountToCollect: number;
  };
  /** Who the rider hands it to. The rate call never needed any of this. */
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  /** Full street address, as opposed to the "City, Province" the rate was quoted against. */
  recipientFullAddress: string;
  /** Our own order reference ("RR-8F3K2M"), so a waybill can be traced back. */
  reference: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `apiShippingRequest` for a rate.
 *
 * `express: false` always. JRS ignores the express flag whenever `productName` is supplied, so
 * standard keeps the quote consistent with the packaging we declared — and every quote we take
 * declares packaging unless the parcel is General Cargo.
 *
 * `productName` is OMITTED, not sent empty, when there's no packaging: an empty string is a value,
 * and JRS would have to interpret it. An absent field is unambiguous.
 */
export function rateRequestBody(input: JrsRateRequest): Raw {
  return {
    express: false,
    insurance: true,
    valuation: true,
    codAmountToCollect: input.codAmountToCollect ?? 0,
    shipperAddressLine1: RATE_ORIGIN,
    recipientAddressLine1: input.recipient,
    shipmentItems: input.shipmentItems,
    ...(input.packagingName ? { productName: input.packagingName } : {}),
  };
}

/**
 * The `apiShippingRequest` for a booking.
 *
 * ASSUMED CONTRACT: the recipient field names here are our best reading of an API we've only been
 * given the rate half of. Everything uncertain is confined to this one function on purpose — when
 * JRS supplies the real booking spec, this body is the only edit.
 */
export function bookingRequestBody(input: JrsBookingRequest): Raw {
  const { shipment } = input;
  return {
    express: shipment.express,
    insurance: shipment.insurance,
    valuation: shipment.valuation,
    codAmountToCollect: shipment.codAmountToCollect,
    shipperAddressLine1: PICKUP_ADDRESS,
    recipientAddressLine1: input.recipientFullAddress || shipment.recipientAddressLine1,
    recipientName: input.recipientName,
    recipientContactNumber: input.recipientPhone,
    recipientEmail: input.recipientEmail,
    shipmentItems: shipment.shipmentItems,
    referenceNumber: input.reference,
    ...(shipment.packagingName ? { productName: shipment.packagingName } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading replies — every value treated as hostile external data
// ─────────────────────────────────────────────────────────────────────────────

export function obj(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** JRS may send numbers as strings ("240.00"); both read as a number, anything else as undefined. */
function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Unwrap whatever envelope the response arrived in.
 *
 * Returns the body itself plus any nested object under the keys these APIs conventionally use, so a
 * field can be found whether it sits at the top level or one layer down. Two levels is the whole
 * search space by design — a deep recursive scan would happily find a number named `amount`
 * somewhere irrelevant and quote it as the shipping fee.
 */
function candidates(body: Raw): Raw[] {
  const ENVELOPES = ["apiShippingResponse", "apiShippingRequest", "data", "result", "response"];
  const out: Raw[] = [body];
  for (const key of ENVELOPES) {
    const nested = obj(body[key]);
    if (Object.keys(nested).length) {
      out.push(nested);
      for (const inner of ENVELOPES) {
        const deeper = obj(nested[inner]);
        if (Object.keys(deeper).length) out.push(deeper);
      }
    }
  }
  return out;
}

/**
 * Lowercase and strip separators, so `totalShippingRate`, `totalshippingrate` and
 * `total_shipping_rate` are the same key.
 *
 * Worth the indirection because the exact casing JRS uses isn't something we can verify from the
 * docs we were given, and the failure mode of guessing wrong is checkout blocking on every order.
 * Field NAMES still have to match — this only forgives how they're spelled.
 */
function normalize(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A scope's keys indexed by their normalized form. Built once per lookup rather than per name. */
function normalized(scope: Raw): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(scope)) {
    // First spelling wins, so a scope with both `rate` and `Rate` behaves predictably.
    if (!out.has(normalize(key))) out.set(normalize(key), value);
  }
  return out;
}

/**
 * First readable number under any of `names`, searched across the unwrapped envelopes.
 *
 * `names` is in PRIORITY order and that order is the whole contract: a response carrying both a
 * per-item rate and an order total must resolve to the total, or we'd undercharge every multi-item
 * order by everything but the first line.
 */
function pickNumber(body: Raw, names: string[]): number | undefined {
  for (const scope of candidates(body)) {
    const keys = normalized(scope);
    for (const name of names) {
      const value = num(keys.get(normalize(name)));
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

/** First non-empty string under any of `names`. Used for the waybill number. */
function pickString(body: Raw, names: string[]): string {
  for (const scope of candidates(body)) {
    const keys = normalized(scope);
    for (const name of names) {
      const value = str(keys.get(normalize(name))).trim();
      if (value) return value;
    }
  }
  return "";
}

/**
 * The costs out of a rate response. `shippingCost` is `undefined` when nothing readable was found —
 * the caller must treat that as a failure, never as free delivery.
 */
export function parseRate(body: Raw): {
  shippingCost: number | undefined;
  insuranceCost: number;
  valuationCost: number;
} {
  return {
    // `TotalShippingRate` is CONFIRMED from a live response and is the whole bill:
    //   BaseRate + Insurance + Valuation + Excess + OtherCharges − Discount
    // It must therefore win over `BaseRate`, which is only the packaging's own rate — quoting that
    // on the parcel below would have charged ₱238 for a delivery that costs ₱732.
    // The rest are defensive leftovers in case a different JRS environment names it otherwise.
    shippingCost: pickNumber(body, [
      "TotalShippingRate",
      "shippingCost",
      "shippingFee",
      "shippingAmount",
      "totalAmount",
    ]),
    insuranceCost: pickNumber(body, ["Insurance", "insuranceCost", "insuranceFee"]) ?? 0,
    valuationCost: pickNumber(body, ["Valuation", "valuationCost", "valuationFee"]) ?? 0,
  };
}

/** The tracking number out of a booking response, or "" if JRS returned none. */
export function parseWaybill(body: Raw): string {
  return pickString(body, [
    "waybillNumber",
    "waybillNo",
    "waybill",
    "trackingNumber",
    "airwaybillNumber",
  ]);
}
