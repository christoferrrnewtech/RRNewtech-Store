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
  | { kind: "2d"; a: number; b: number; maxThickness?: number }
  | { kind: "3d"; a: number; b: number; c: number };

/**
 * JRS's standard packaging, SMALLEST FIRST — the order is the algorithm, since the first match
 * wins and the cheapest adequate box is the one we want.
 *
 * Two things here are not obvious and are not mistakes:
 *
 *  - Express Letter has NO thickness limit. It is a flexible pouch, so a stack that fits the
 *    footprint and stays under 100 g goes in however tall it is.
 *  - Bulilit Box is checked BEFORE 5 Pounder even though they share a 2500 g cap. It is the only
 *    genuinely three-dimensional option (a deep, small-footprint box), so a tall narrow stack that
 *    no flat pouch can take still finds a home before we jump to the largest.
 */
export const JRS_PACKAGING: readonly { name: string; maxWeight: number; fit: Fit }[] = [
  { name: "Express Letter", maxWeight: 100, fit: { kind: "2d", a: 24.13, b: 16.0 } },
  { name: "1 Pounder", maxWeight: 500, fit: { kind: "2d", a: 38.1, b: 27.94, maxThickness: 5 } },
  { name: "3 Pounder", maxWeight: 1500, fit: { kind: "2d", a: 45.72, b: 35.56, maxThickness: 7 } },
  { name: "Bulilit Box", maxWeight: 2500, fit: { kind: "3d", a: 20.32, b: 29.21, c: 10.16 } },
  { name: "5 Pounder", maxWeight: 2500, fit: { kind: "2d", a: 50.8, b: 35.56, maxThickness: 10 } },
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
 * Interior of {@link FALLBACK_PACKAGING}, for declaring an unmeasured remainder to JRS.
 *
 * The weight is the packaging's own cap, which is the honest declaration for "we don't know" — and
 * being the smaller cap (500 g rather than 1500 g) it is also the one that doesn't manufacture
 * excess charges out of items nobody has measured yet.
 */
export const FALLBACK_PARCEL: ParcelItem = {
  length: 38.1,
  width: 27.94,
  height: 5,
  weight: 500,
};

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
 * The smallest JRS packaging this cart fits, or `undefined` for General Cargo.
 *
 * `undefined` is not a failure — it means the parcel is bigger or heavier than every standard box,
 * so the `productName` field is omitted from the rate request entirely and JRS decides. That is
 * exactly what we want for a dental chair.
 *
 * An empty array also returns `undefined`: nothing measured is not the same as "fits an Express
 * Letter", and callers that want a floor apply it in `packagingForCart` below.
 */
export function determineProductName(items: ParcelItem[]): string | undefined {
  if (items.length === 0) return undefined;

  const parcel = aggregate(items);

  for (const option of JRS_PACKAGING) {
    if (parcel.totalWeight > option.maxWeight) continue;
    const fits =
      option.fit.kind === "2d"
        ? fitsIn2D(parcel, option.fit.a, option.fit.b, option.fit.maxThickness)
        : fitsIn3D(parcel, option.fit.a, option.fit.b, option.fit.c);
    if (fits) return option.name;
  }

  return undefined;
}

/**
 * What to declare for a REAL cart, where some products may not have been measured yet.
 *
 * Dimensions are optional on a product, so a cart can contain units we know nothing about. Ignoring
 * them outright would let one small measured item quote the whole order as an Express Letter, and
 * we'd be paying the difference on every such order. So whenever anything is unmeasured the
 * {@link FALLBACK_PACKAGING} acts as a FLOOR: never smaller than the box that fits most orders.
 *
 * A genuinely larger result still wins — the floor raises, it never caps. Note that `undefined`
 * with measured items present means "already bigger than every box", which is above the floor, so
 * it survives; `undefined` with nothing measured means "no idea", which is below it.
 */
export function packagingForCart(
  measured: ParcelItem[],
  hasUnmeasured: boolean,
): string | undefined {
  const natural = determineProductName(measured);
  if (!hasUnmeasured) return natural;

  if (measured.length === 0) return FALLBACK_PACKAGING;
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
 * Unmeasured units don't vanish. They collapse into ONE remainder entry carrying
 * {@link FALLBACK_PARCEL} and the summed value of everything that wasn't measured. One synthetic
 * parcel rather than one per item, because the intent is a single box for the order — five
 * fallback-sized entries would describe five boxes and be rated as such. Keeping their declared
 * value in it is what stops an unmeasured item from also being an uninsured one.
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

  if (hasUnmeasured) {
    shipmentItems.push({ declaredValue: unmeasuredValue, ...FALLBACK_PARCEL });
  }

  return { shipmentItems, packagingName: packagingForCart(measured, hasUnmeasured) };
}
