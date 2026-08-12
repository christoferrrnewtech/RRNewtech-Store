/**
 * Assertions for the pure JRS logic — `npm run test:jrs`.
 *
 * Covers the two modules with no secrets and no network: the packaging chooser
 * (`jrs-packaging.ts`) and the request/response protocol (`jrs-protocol.ts`). The repo has no test
 * runner and adding one for two pure modules isn't worth the infrastructure, so this follows the
 * same `tsx` script precedent as `paymongo-webhook.ts`: plain asserts, exits non-zero on failure.
 *
 * These are the modules where a wrong answer is INVISIBLE — every case still returns a plausible
 * box name, and a mis-parsed response still returns a plausible number of pesos. So the cases below
 * deliberately sit on the boundaries: the exact weight caps, the exact lid heights, the rotations
 * that must not change the outcome, and the field-name priority that decides what we charge.
 *
 * For the live API (does JRS actually return what we think?) use `npm run jrs:rate` instead.
 */

import assert from "node:assert/strict";
import {
  aggregate,
  buildParcel,
  determineProductName,
  FALLBACK_PACKAGING,
  FALLBACK_PARCEL,
  isMeasured,
  packagingForCart,
  toParcelItem,
  type ParcelItem,
} from "../src/lib/jrs-packaging";
import {
  parseRate,
  parseWaybill,
  rateRequestBody,
  RATE_ORIGIN,
} from "../src/lib/jrs-protocol";

/**
 * A REAL getrate response, captured 2026-08-12. Pinned here verbatim so the parser is tested
 * against what JRS actually sends rather than what we hoped it would.
 *
 * Note `BaseRate: 238` against `TotalShippingRate: 732` — the excess is two thirds of the bill.
 */
const LIVE_RESPONSE = {
  Id: "1f0bf32f-a429-493f-9fa2-8b88120ceb41",
  OriginProvince: "Metro Manila",
  OriginMunicipal: "Makati City",
  DestinationProvince: "Metro Manila",
  DestinationMunicipal: "Makati City",
  EstimatedDeliveryDate: "2026-08-13T00:35:35.2260006+00:00",
  Name: "3 Pounder",
  BaseRate: 238.0,
  Insurance: 0.0,
  Valuation: 18.0,
  Excess: 476.0,
  OtherCharges: 0.0,
  TotalShippingRate: 732.0,
  Discount: 0.0,
  Withholdingtax: null,
};

let passed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** Shorthand: an item in cm/grams. */
const item = (length: number, width: number, height: number, weight: number): ParcelItem => ({
  length,
  width,
  height,
  weight,
});

console.log("\naggregate — items share a base and stack vertically");

check("footprint takes the max, height and weight sum", () => {
  const parcel = aggregate([item(20, 10, 2, 100), item(8, 30, 3, 50)]);
  assert.equal(parcel.maxShort, 10, "max of min(w,l) over items");
  assert.equal(parcel.maxLong, 30, "max of max(w,l) over items");
  assert.equal(parcel.totalHeight, 5);
  assert.equal(parcel.totalWeight, 150);
});

check("an empty cart aggregates to zeroes, not -Infinity", () => {
  assert.deepEqual(aggregate([]), {
    maxShort: 0,
    maxLong: 0,
    totalHeight: 0,
    totalWeight: 0,
  });
});

console.log("\ndetermineProductName — first match, smallest to largest");

check("Express Letter: under 100 g and inside 24.13 × 16.00", () => {
  assert.equal(determineProductName([item(24, 15, 1, 90)]), "Express Letter");
});

check("Express Letter has NO thickness limit — it's a flexible pouch", () => {
  // 20 cm tall, still a letter, because only weight and footprint are capped.
  const tall = Array.from({ length: 20 }, () => item(20, 12, 1, 5));
  assert.equal(determineProductName(tall), "Express Letter");
});

check("rotation independence: 15 × 24 fits the 24.13 × 16.00 letter turned round", () => {
  assert.equal(determineProductName([item(15, 24, 1, 90)]), "Express Letter");
  assert.equal(determineProductName([item(24, 15, 1, 90)]), "Express Letter");
});

check("101 g falls past the letter to the 1 Pounder", () => {
  assert.equal(determineProductName([item(24, 15, 1, 100)]), "Express Letter");
  assert.equal(determineProductName([item(24, 15, 1, 101)]), "1 Pounder");
});

check("too wide for the letter falls to the 1 Pounder even at 10 g", () => {
  assert.equal(determineProductName([item(30, 20, 1, 10)]), "1 Pounder");
});

check("1 Pounder respects its 5 cm lid", () => {
  assert.equal(determineProductName([item(30, 20, 5, 400)]), "1 Pounder");
  assert.equal(determineProductName([item(30, 20, 5.1, 400)]), "3 Pounder");
});

check("3 Pounder: 1500 g and the 7 cm lid are inclusive bounds", () => {
  assert.equal(determineProductName([item(40, 30, 7, 1500)]), "3 Pounder");
  assert.equal(determineProductName([item(40, 30, 7, 1501)]), "5 Pounder");
});

check("Bulilit Box is checked BEFORE the 5 Pounder", () => {
  // Deep and narrow: 9 cm tall breaks the 3 Pounder's 7 cm lid, and the footprint fits Bulilit.
  const deep = item(28, 19, 9, 2000);
  assert.equal(determineProductName([deep]), "Bulilit Box");
});

check("a wide flat parcel skips Bulilit and lands on the 5 Pounder", () => {
  // 50 × 34 is far wider than Bulilit's 29.21 long side, but inside the 5 Pounder.
  assert.equal(determineProductName([item(50, 34, 9, 2000)]), "5 Pounder");
});

check("5 Pounder respects its 10 cm lid and 2500 g cap", () => {
  assert.equal(determineProductName([item(50, 35, 10, 2500)]), "5 Pounder");
  assert.equal(determineProductName([item(50, 35, 10.1, 2500)]), undefined);
  assert.equal(determineProductName([item(50, 35, 10, 2501)]), undefined);
});

check("General Cargo (undefined) for anything past every box", () => {
  assert.equal(determineProductName([item(120, 80, 60, 40000)]), undefined);
});

check("an empty array is General Cargo, not an Express Letter", () => {
  assert.equal(determineProductName([]), undefined);
});

check("quantity stacks: three 3 cm items break the 1 Pounder's 5 cm lid", () => {
  const one = item(30, 20, 3, 100);
  assert.equal(determineProductName([one]), "1 Pounder");
  assert.equal(determineProductName([one, one]), "3 Pounder"); // 6 cm > 5
  assert.equal(determineProductName([one, one, one]), "5 Pounder"); // 9 cm > 7
});

console.log("\npackagingForCart — the fallback floor when something is unmeasured");

check("nothing unmeasured: passes determineProductName straight through", () => {
  assert.equal(packagingForCart([item(24, 15, 1, 90)], false), "Express Letter");
  assert.equal(packagingForCart([], false), undefined);
});

check("nothing measured at all: the fallback box", () => {
  assert.equal(packagingForCart([], true), FALLBACK_PACKAGING);
});

check("the floor raises a too-small result", () => {
  assert.equal(packagingForCart([item(24, 15, 1, 90)], true), FALLBACK_PACKAGING);
  assert.equal(packagingForCart([item(30, 20, 3, 400)], true), FALLBACK_PACKAGING);
});

check("the floor never caps a larger genuine result", () => {
  assert.equal(packagingForCart([item(28, 19, 9, 2000)], true), "Bulilit Box");
  assert.equal(packagingForCart([item(50, 34, 9, 2000)], true), "5 Pounder");
});

check("General Cargo survives the floor — it is already bigger than every box", () => {
  assert.equal(packagingForCart([item(120, 80, 60, 40000)], true), undefined);
});

console.log("\nisMeasured — a partial product can't be rated");

check("all four positive numbers required", () => {
  assert.equal(isMeasured({ length: 1, width: 2, height: 3, weight: 4 }), true);
  assert.equal(isMeasured({ length: 1, width: 2, height: 3 }), false);
  assert.equal(isMeasured({ length: 1, width: 2, height: 0, weight: 4 }), false);
  assert.equal(isMeasured({ length: 1, width: 2, height: -3, weight: 4 }), false);
  assert.equal(isMeasured({ length: 1, width: 2, height: NaN, weight: 4 }), false);
  assert.equal(isMeasured(undefined), false);
});

check("toParcelItem copies ONLY the four fields — never the whole product", () => {
  // The regression this guards: `{...product}` type-checks fine after an `isMeasured` narrow, and
  // would quietly POST a product's gallery and description to the courier.
  const product = {
    id: "abc",
    name: "Composite kit",
    price: 1200,
    image: "https://example.test/x.webp",
    gallery: [{ src: "https://example.test/y.webp" }],
    description: ["a", "b"],
    inStock: true,
    length: 20,
    width: 14,
    height: 3,
    weight: 400,
  };
  assert.deepEqual(toParcelItem(product), { length: 20, width: 14, height: 3, weight: 400 });
  assert.equal(toParcelItem({ length: 20, width: 14, height: 3 }), undefined);
});

console.log("\nbuildParcel — quantity expansion and the unmeasured remainder");

check("expands by quantity, one entry per unit", () => {
  const { shipmentItems, packagingName } = buildParcel([
    { price: 500, quantity: 3, parcel: item(20, 14, 1, 300) },
  ]);
  assert.equal(shipmentItems.length, 3);
  assert.deepEqual(shipmentItems[0], {
    declaredValue: 500,
    length: 20,
    width: 14,
    height: 1,
    weight: 300,
  });
  // 3 cm of stack, 900 g — past the 1 Pounder's 500 g cap, inside the 3 Pounder.
  assert.equal(packagingName, "3 Pounder");
});

check("unmeasured units collapse into ONE remainder carrying their whole declared value", () => {
  const { shipmentItems, packagingName } = buildParcel([
    { price: 500, quantity: 1, parcel: item(20, 14, 1, 300) },
    { price: 250, quantity: 4, parcel: undefined },
  ]);
  assert.equal(shipmentItems.length, 2, "one measured entry + one remainder, not five");
  assert.deepEqual(shipmentItems[1], { declaredValue: 1000, ...FALLBACK_PARCEL });
  // The measured item alone would be a 1 Pounder; the floor raises it.
  assert.equal(packagingName, FALLBACK_PACKAGING);
});

check("a wholly unmeasured cart is one fallback entry at the full order value", () => {
  const { shipmentItems, packagingName } = buildParcel([
    { price: 300, quantity: 2, parcel: undefined },
  ]);
  assert.deepEqual(shipmentItems, [{ declaredValue: 600, ...FALLBACK_PARCEL }]);
  assert.equal(packagingName, FALLBACK_PACKAGING);
});

check("a fully measured cart adds no remainder entry", () => {
  const { shipmentItems } = buildParcel([{ price: 90, quantity: 2, parcel: item(24, 15, 1, 40) }]);
  assert.equal(shipmentItems.length, 2);
});

console.log("\nparseRate — what we charge depends on reading the right field");

check("reads the real captured response", () => {
  const rate = parseRate(LIVE_RESPONSE);
  assert.equal(rate.shippingCost, 732, "the TOTAL, not the 238 base rate");
  assert.equal(rate.insuranceCost, 0);
  assert.equal(rate.valuationCost, 18);
});

check("TotalShippingRate beats BaseRate — the expensive regression", () => {
  // Quoting BaseRate here would charge ₱238 for a ₱732 delivery and eat ₱494 per order. The
  // ordering of the name list is the only thing preventing it, so assert it directly.
  assert.equal(parseRate(LIVE_RESPONSE).shippingCost, 732);
  assert.notEqual(parseRate(LIVE_RESPONSE).shippingCost, LIVE_RESPONSE.BaseRate);
});

check("field matching ignores casing and separators", () => {
  assert.equal(parseRate({ TotalShippingRate: 240 }).shippingCost, 240);
  assert.equal(parseRate({ totalshippingrate: 240 }).shippingCost, 240);
  assert.equal(parseRate({ total_shipping_rate: 240 }).shippingCost, 240);
  assert.equal(parseRate({ "Total Shipping Rate": 240 }).shippingCost, 240);
});

check("numbers sent as strings are read as numbers", () => {
  assert.equal(parseRate({ TotalShippingRate: "240.50" }).shippingCost, 240.5);
});

check("finds costs one and two envelopes deep", () => {
  assert.equal(parseRate({ apiShippingResponse: LIVE_RESPONSE }).shippingCost, 732);
  assert.equal(parseRate({ data: { result: LIVE_RESPONSE } }).shippingCost, 732);
});

check("an unreadable body yields undefined — the caller must block, not charge 0", () => {
  assert.equal(parseRate({}).shippingCost, undefined);
  assert.equal(parseRate({ status: "OK", message: "none" }).shippingCost, undefined);
  assert.equal(parseRate({ TotalShippingRate: "not a number" }).shippingCost, undefined);
  // A response carrying ONLY a base rate must fail rather than quote it — a partial read is worse
  // than no read, because it looks like a working quote.
  assert.equal(parseRate({ BaseRate: 238, Excess: 476 }).shippingCost, undefined);
  // Not three levels deep past envelopes we don't recognise — a blind deep scan would find this
  // and quote it, which is exactly the false positive the bounded search exists to avoid.
  assert.equal(parseRate({ a: { b: { c: { TotalShippingRate: 240 } } } }).shippingCost, undefined);
});

check("the request's own boolean flags can't be mistaken for costs", () => {
  // `insurance: true` echoed back must not read as an insurance cost.
  const rate = parseRate({ TotalShippingRate: 240, Insurance: true, Valuation: true });
  assert.equal(rate.insuranceCost, 0);
  assert.equal(rate.valuationCost, 0);
});

check("parseWaybill reads a tracking number, or '' when there isn't one", () => {
  assert.equal(parseWaybill({ waybillNumber: "JRS123456" }), "JRS123456");
  assert.equal(parseWaybill({ apiShippingResponse: { waybillNo: "JRS123456" } }), "JRS123456");
  assert.equal(parseWaybill({ WAYBILL_NUMBER: "JRS123456" }), "JRS123456");
  assert.equal(parseWaybill({ waybillNumber: "   " }), "", "whitespace is not a waybill");
  assert.equal(parseWaybill({}), "");
});

console.log("\nrateRequestBody — the flags JRS is sensitive to");

check("express is always false and productName is OMITTED for General Cargo", () => {
  const withBox = rateRequestBody({
    recipient: "Cebu City, Cebu",
    shipmentItems: [{ declaredValue: 850, length: 20, width: 14, height: 3, weight: 400 }],
    packagingName: "3 Pounder",
  });
  assert.equal(withBox.express, false);
  assert.equal(withBox.insurance, true);
  assert.equal(withBox.valuation, true);
  assert.equal(withBox.codAmountToCollect, 0);
  assert.equal(withBox.shipperAddressLine1, RATE_ORIGIN);
  assert.equal(withBox.recipientAddressLine1, "Cebu City, Cebu");
  assert.equal(withBox.productName, "3 Pounder");

  const cargo = rateRequestBody({
    recipient: "Cebu City, Cebu",
    shipmentItems: [],
    packagingName: undefined,
  });
  assert.equal("productName" in cargo, false, "absent, not empty — an empty string is a value");
});

console.log(
  process.exitCode ? "\nFAILED — see above.\n" : `\nAll ${passed} checks passed.\n`,
);
