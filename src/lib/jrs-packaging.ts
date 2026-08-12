/**
 * JRS Express packaging selection — CLIENT-SAFE, pure.
 *
 * JRS prices a shipment by the named packaging it goes in ("1 Pounder", "Bulilit Box", …), not by
 * raw dimensions, so before we can ask for a rate we have to decide which box the cart fits. This
 * module is that decision and nothing else: no network, no Firestore, no env. That keeps it
 * testable from a plain script (see `scripts/box-fit.ts`) and lets the checkout panel and the
 * server action reach the same answer from the same code.
 *
 * THE PARCEL MODEL: everything in the cart goes into ONE box, items sharing a base and stacked
 * vertically. So the footprint is the largest single footprint (not the sum), and only the height
 * accumulates:
 *
 *     maxShort    = max over items of min(width, length)
 *     maxLong     = max over items of max(width, length)
 *     totalHeight = Σ height
 *     totalWeight = Σ weight
 *
 * It is deliberately optimistic — real packing leaves gaps, and two items 0.1 cm under the lid do
 * not actually close. That is fine here: the packaging name is a declaration to JRS, they weigh
 * and measure at pickup, and an under-declared parcel is re-rated rather than lost. Being generous
 * costs the occasional adjustment; being pessimistic overcharges every customer.
 *
 * ROTATION INDEPENDENCE: a 16 × 24 item fits a 24.13 × 16.00 Express Letter — you turn it. Every
 * comparison therefore sorts both the parcel's sides and the package's sides before comparing, so
 * which field an admin typed a number into never changes the answer.
 *
 * Units: centimetres for the three lengths, GRAMS for weight. Mixing those up is the one mistake
 * that produces a plausible-looking wrong answer, hence the repetition in the types below.
 */

/** One physical unit in the cart. All four values required — a partial item can't be rated. */
export type ParcelItem = {
  /** cm */
  length: number;
  /** cm */
  width: number;
  /** cm */
  height: number;
  /** grams */
  weight: number;
};

/** The aggregate box the cart forms. Exported so callers can log or display what was measured. */
export type Parcel = {
  maxShort: number;
  maxLong: number;
  totalHeight: number;
  /** grams */
  totalWeight: number;
};

type Fit =
  | { kind: "2d"; a: number; b: number; maxThickness: number }
  | { kind: "3d"; a: number; b: number; c: number };

/**
 * What a packaging costs at a given weight — for RANKING ONLY, never for display.
 *
 * Measured from the live tariff to Cebu City (see `data/jrs-tariff.json`) and reproduced exactly by
 * `npm run test:jrs`. The pesos are real but they are NOT the price: base rates are zone-dependent,
 * so what these encode is which box is cheaper than which, on the assumption that zones scale the
 * whole table rather than reshuffling it. The figure a customer sees always comes from a live
 * `getrate`, never from here.
 *
 * UNVERIFIED: that zone assumption. If some province prices the boxes in a different order we would
 * pick a more expensive box there — never an invalid one. Ten requests against a second destination
 * would settle it.
 */
type Cost = (grams: number) => number;

/**
 * The pouches: a base rate covering the first tier, then HALF the base again per further step.
 * Confirmed exactly across all sixteen readings — `excess` is always `base / 2 × steps`.
 */
function stepped(base: number, first: number, step: number): Cost {
  return (grams) => base * (1 + 0.5 * Math.max(0, Math.ceil((grams - first) / step)));
}

/** The Bulilit Box doesn't step — it re-rates in flat bands. Also measured, not assumed. */
function banded(bands: [upTo: number, cost: number][]): Cost {
  return (grams) => bands.find(([upTo]) => grams <= upTo)?.[1] ?? bands[bands.length - 1][1];
}

/**
 * JRS's standard packaging. Listed smallest first, but the ORDER IS NOT THE ALGORITHM — see
 * `determineProductName`: dimensions decide what is possible, then price decides between them.
 *
 * FOOTPRINTS ARE CONFIRMED against JRS's published figures, which are given in inches:
 *
 *   Express Letter   9.5" × 6.3"       → 24.13 × 16.00 cm
 *   1 Pounder        15"  × 11"        → 38.10 × 27.94 cm
 *   3 Pounder        18"  × 14"        → 45.72 × 35.56 cm
 *   5 Pounder        20"  × 14"        → 50.80 × 35.56 cm
 *   Bulilit Box      11.5" × 8" × 4"   → 29.21 × 20.32 × 10.16 cm
 *
 * `maxThickness` IS OURS, NOT JRS'S. They publish two dimensions for the pouches and nothing about
 * depth, and `npm run jrs:limits` proved the tariff never checks dimensions at all — every probe
 * from 1 cm to 20 cm, on every packaging, came back with zero excess.
 *
 * The tempting conclusion is to drop these limits. It is the wrong one. Because JRS doesn't check,
 * THIS MODULE IS THE ONLY THING standing between a cart and a declaration that cannot physically be
 * packed — an unchecked stack would be quoted happily as an Express Letter and then refused by the
 * rider at pickup. So the depths stay, as a packing heuristic: 2 cm for the document pouch, then
 * 5 / 7 / 10. They err towards a bigger box, which costs a little and never gets refused.
 *
 * `maxWeight` is likewise PHYSICAL, not a tariff limit. JRS bills past it — "minimum charge for the
 * 1st 500 grams, additional charge for succeeding 500 grams" is a surcharge, not a refusal — so the
 * ceilings here are about what a pouch can actually hold without tearing. Each sits one tariff step
 * above its band, which is as far as the cost model ever wants to push a box anyway.
 */
export const JRS_PACKAGING: readonly {
  name: string;
  /** PHYSICAL ceiling — see the header. Not a tariff limit; JRS will happily price past it. */
  maxWeight: number;
  fit: Fit;
  cost: Cost;
}[] = [
  {
    name: "Express Letter",
    maxWeight: 200,
    fit: { kind: "2d", a: 24.13, b: 16.0, maxThickness: 2 },
    cost: stepped(125, 100, 100),
  },
  {
    name: "1 Pounder",
    maxWeight: 1000,
    fit: { kind: "2d", a: 38.1, b: 27.94, maxThickness: 5 },
    cost: stepped(153, 500, 500),
  },
  {
    name: "3 Pounder",
    maxWeight: 2000,
    fit: { kind: "2d", a: 45.72, b: 35.56, maxThickness: 7 },
    cost: stepped(293, 1500, 500),
  },
  {
    name: "Bulilit Box",
    // The tariff is flat to 20 kg (measured), so this ceiling is PURELY physical. The box is
    // 29.21 × 20.32 × 10.16 cm ≈ 6.0 litres; 6 kg is that volume at the density of water, which no
    // dental consumable exceeds. 20 kg in 6 litres would be denser than aluminium — JRS would quote
    // it happily and no rider would accept it.
    maxWeight: 6000,
    fit: { kind: "3d", a: 20.32, b: 29.21, c: 10.16 },
    cost: banded([
      [2500, 300],
      // Flat above the first band — confirmed unchanged at 3.5, 4.5, 5, 10 and 20 kg.
      [Number.POSITIVE_INFINITY, 367.5],
    ]),
  },
  {
    name: "5 Pounder",
    maxWeight: 3000,
    fit: { kind: "2d", a: 50.8, b: 35.56, maxThickness: 10 },
    cost: stepped(333, 2500, 500),
  },
] as const;

/**
 * The box we fall back to when the cart can't be measured — see `packagingForCart`.
 *
 * WHY THE SMALL ONE. A rate response looks like
 * `{ BaseRate: 238, Excess: 476, TotalShippingRate: 732 }` — JRS bills the declared packaging and
 * then adds an EXCESS charge for whatever overflows it. So declaring a big box doesn't buy safety,
 * it just raises the floor: the excess is charged either way, on top of a larger base. Declaring
 * the small one keeps the base low and lets the excess reflect what's actually being carried.
 */
export const FALLBACK_PACKAGING = "1 Pounder";

/**
 * The full interior of {@link FALLBACK_PACKAGING} — the ALLOWANCE an unmeasured remainder is
 * declared against, not a fixed size to add on top.
 *
 * See {@link remainderParcel}: the remainder fills what's left of this after the measured items,
 * so the whole declaration comes to exactly one 1 Pounder rather than a 1 Pounder plus extra.
 */
export const FALLBACK_PARCEL: ParcelItem = {
  length: 38.1,
  width: 27.94,
  height: 5,
  weight: 500,
};

/** A shipment item of zero size is not a thing JRS can price; this is the floor for a used-up one. */
const MIN_REMAINDER = 1;

/**
 * How to declare "and some things we haven't measured".
 *
 * It takes up whatever is LEFT of the fallback box's allowance once the measured items are in it —
 * 120 g of measured goods leaves a 380 g remainder, not another 500 g. Declaring the full 500 g on
 * top was manufacturing our own excess charge: JRS bills `Excess` on whatever overflows the
 * declared packaging, so a 1 Pounder declared as containing 620 g is 120 g of overflow we invented.
 *
 * The footprint stays the box's own, since items share a base and the declaration is "one 1 Pounder".
 *
 * When the measured items already exceed the allowance the remainder collapses to nothing much —
 * correct, because at that point the parcel is genuinely bigger than a 1 Pounder and
 * `packagingForCart` will have chosen a bigger box for it anyway.
 */
function remainderParcel(measured: ParcelItem[]): ParcelItem {
  const used = aggregate(measured);
  return {
    length: FALLBACK_PARCEL.length,
    width: FALLBACK_PARCEL.width,
    height: Math.max(MIN_REMAINDER, FALLBACK_PARCEL.height - used.totalHeight),
    weight: Math.max(MIN_REMAINDER, FALLBACK_PARCEL.weight - used.totalWeight),
  };
}

/**
 * One unit as JRS wants it: a measured parcel plus what it's worth.
 *
 * Lives here rather than in `jrs.ts` so both the server-only courier module and this client-safe
 * one can name it without dragging `server-only` across the boundary.
 */
export type JrsShipmentItem = ParcelItem & {
  /** Peso value of this unit — drives insurance and valuation. */
  declaredValue: number;
};

/** Every value present, positive and finite. A zero dimension is missing data, not a flat item. */
export function isMeasured(item: Partial<ParcelItem> | undefined): item is ParcelItem {
  if (!item) return false;
  return [item.length, item.width, item.height, item.weight].every(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
}

/**
 * The four dimensions of a product, or `undefined` if it isn't fully measured.
 *
 * Note the explicit field-by-field copy. Callers hold a whole `BrandProduct`, and spreading one
 * would put its name, price, gallery and description arrays into the request body we POST to JRS
 * and then freeze onto the order document forever. `isMeasured` narrows the TYPE but cannot narrow
 * the runtime object, so this is the only thing standing between a courier API and our whole
 * catalog.
 */
export function toParcelItem(item: Partial<ParcelItem> | undefined): ParcelItem | undefined {
  if (!isMeasured(item)) return undefined;
  return { length: item.length, width: item.width, height: item.height, weight: item.weight };
}

/** Collapse the cart into the single virtual box described in the header. */
export function aggregate(items: ParcelItem[]): Parcel {
  const parcel: Parcel = { maxShort: 0, maxLong: 0, totalHeight: 0, totalWeight: 0 };
  for (const item of items) {
    parcel.maxShort = Math.max(parcel.maxShort, Math.min(item.width, item.length));
    parcel.maxLong = Math.max(parcel.maxLong, Math.max(item.width, item.length));
    parcel.totalHeight += item.height;
    parcel.totalWeight += item.weight;
  }
  return parcel;
}

/**
 * Does the parcel's footprint fit an `a` × `b` package?
 *
 * Both pairs are sorted into short/long first, so the caller may list the package's sides in any
 * order and an item's length/width may be entered either way round.
 *
 * `maxThickness` is the lid: rigid packaging also caps how tall the stack may be. Omitting it means
 * "no limit", which today is only the Express Letter pouch.
 */
export function fitsIn2D(parcel: Parcel, a: number, b: number, maxThickness?: number): boolean {
  const [packShort, packLong] = a <= b ? [a, b] : [b, a];
  if (parcel.maxShort > packShort || parcel.maxLong > packLong) return false;
  if (maxThickness !== undefined && parcel.totalHeight > maxThickness) return false;
  return true;
}

/**
 * Does the parcel fit an `a` × `b` × `c` box in ANY orientation?
 *
 * Sorting both triples ascending and comparing elementwise is the standard result: a box fits
 * inside another in some rotation exactly when its sorted dimensions are all ≤ the other's sorted
 * dimensions. Cheaper and less error-prone than enumerating six orientations.
 */
export function fitsIn3D(parcel: Parcel, a: number, b: number, c: number): boolean {
  const pack = [a, b, c].sort((x, y) => x - y);
  const item = [parcel.maxShort, parcel.maxLong, parcel.totalHeight].sort((x, y) => x - y);
  return item.every((value, i) => value <= pack[i]);
}

/**
 * The CHEAPEST JRS packaging this cart physically fits, or `undefined` for General Cargo.
 *
 * Two stages, and the order matters: dimensions and physical weight decide which boxes are
 * possible, then the tariff decides between them. Cost never overrides fit — a parcel that only
 * fits a 5 Pounder gets a 5 Pounder however expensive that is.
 *
 * "Smallest that fits" was the obvious rule and it was costing money, because JRS's surcharge is
 * half the base rate per step and the base rates are far apart. At 800 g the smallest box that
 * fits by tier is a 3 Pounder at ₱293, while a 1 Pounder one step over is ₱229.50 — ₱63.50 saved
 * on every order in that band by simply not stepping up. Above 2,500 g the old rule gave up
 * entirely and fell to General Cargo, when a Bulilit Box would have taken it for a flat ₱367.50.
 *
 * `undefined` is not a failure — it means the parcel is bigger or heavier than every standard box,
 * so `productName` is omitted from the rate request and JRS prices it as General Cargo. That is
 * exactly what we want for a dental chair.
 *
 * An empty array also returns `undefined`: nothing measured is not the same as "fits an Express
 * Letter", and callers that want a floor apply it in `packagingForCart` below.
 */
export function determineProductName(items: ParcelItem[]): string | undefined {
  if (items.length === 0) return undefined;

  const parcel = aggregate(items);
  const candidates = JRS_PACKAGING.filter((option) => {
    if (parcel.totalWeight > option.maxWeight) return false;
    return option.fit.kind === "2d"
      ? fitsIn2D(parcel, option.fit.a, option.fit.b, option.fit.maxThickness)
      : fitsIn3D(parcel, option.fit.a, option.fit.b, option.fit.c);
  });

  if (candidates.length === 0) return undefined;

  // Cheapest of the ones it fits. `reduce` keeps the earlier entry on a tie, and JRS_PACKAGING is
  // ordered smallest-first, so equal-priced boxes resolve to the smaller — which is the one a
  // packer would reach for anyway.
  return candidates.reduce((best, option) =>
    option.cost(parcel.totalWeight) < best.cost(parcel.totalWeight) ? option : best,
  ).name;
}

/**
 * What to declare for a REAL cart, where some products may not have been measured yet.
 *
 * `declared` is EVERYTHING going to JRS — the measured units plus the synthetic remainder standing
 * in for the unmeasured ones. Passing only the measured part would name a box the declared contents
 * don't fit in, which is precisely what JRS charges `Excess` for.
 *
 * On top of that, {@link FALLBACK_PACKAGING} acts as a FLOOR whenever anything is unmeasured: never
 * smaller than the box that fits most orders. Largely belt-and-braces now that the remainder is
 * itself a full fallback box and therefore drags the aggregate up on its own — but it keeps holding
 * the line if the remainder is ever made smaller.
 *
 * A genuinely larger result always wins: the floor raises, it never caps. `undefined` means the
 * parcel is bigger than every standard box, which is above the floor, so it survives.
 */
export function packagingForCart(
  declared: ParcelItem[],
  hasUnmeasured: boolean,
): string | undefined {
  const natural = determineProductName(declared);
  if (!hasUnmeasured) return natural;

  if (declared.length === 0) return FALLBACK_PACKAGING;
  // Bigger than everything JRS boxes — General Cargo is above the floor, so keep it.
  if (natural === undefined) return undefined;

  const floor = JRS_PACKAGING.findIndex((p) => p.name === FALLBACK_PACKAGING);
  const found = JRS_PACKAGING.findIndex((p) => p.name === natural);
  return found < floor ? FALLBACK_PACKAGING : natural;
}

/**
 * Turn priced order lines into the parcel JRS is asked to rate.
 *
 * `shipmentItems` is expanded by QUANTITY — three of the same item is three entries, because the
 * fitting model stacks physical units and JRS insures each declared value separately.
 *
 * Unmeasured units don't vanish, and they don't multiply either. However many there are, they
 * collapse into ONE remainder entry (see {@link remainderParcel}) carrying the summed value of all
 * of them. One synthetic parcel rather than one per item, because the intent is a single box for
 * the order — five fallback-sized entries would describe five boxes and be rated as five. Keeping
 * their declared value in it is what stops an unmeasured item from also being an uninsured one.
 *
 * Shared by the checkout quote and the admin's fallback quote so an order booked months later is
 * described exactly the way it was priced.
 */
export function buildParcel(
  lines: { price: number; quantity: number; parcel: ParcelItem | undefined }[],
): { shipmentItems: JrsShipmentItem[]; packagingName: string | undefined } {
  const shipmentItems: JrsShipmentItem[] = [];
  const measured: ParcelItem[] = [];
  let unmeasuredValue = 0;
  let hasUnmeasured = false;

  for (const { price, quantity, parcel } of lines) {
    for (let i = 0; i < quantity; i++) {
      if (parcel) {
        measured.push(parcel);
        shipmentItems.push({ declaredValue: price, ...parcel });
      } else {
        hasUnmeasured = true;
        unmeasuredValue += price;
      }
    }
  }

  const remainder = hasUnmeasured ? remainderParcel(measured) : undefined;
  if (remainder) {
    shipmentItems.push({ declaredValue: unmeasuredValue, ...remainder });
  }

  // Chosen from EVERYTHING we declare, remainder included — not from the measured part alone.
  // That is what guarantees no excess: JRS bills `Excess` on whatever overflows the named
  // packaging, so the named packaging has to be one the declared contents actually fit in. Picking
  // from `measured` let the remainder's own height and weight push the parcel past the box we'd
  // just named, and JRS would bill us for the overflow we ourselves described.
  const declared = remainder ? [...measured, remainder] : measured;

  return { shipmentItems, packagingName: packagingForCart(declared, hasUnmeasured) };
}
