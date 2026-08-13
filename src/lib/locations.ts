/**
 * Philippine delivery locations — SERVER ONLY, read from a committed snapshot.
 *
 * 82 provinces, 1,634 cities/municipalities and 42,046 barangays, generated from the PSA's PSGC by
 * `npm run sync:locations` into `data/ph-locations.json`. Nothing calls a network at runtime;
 * lookups are off an in-memory copy and are sub-millisecond.
 *
 * WHAT THIS DOES AND DOESN'T GUARANTEE. JRS publishes no serviceable-area list, so this answers
 * "is this a real Philippine address?" and NOT "will JRS deliver there?". `getrate` is the only
 * authority on the second question, and an address it refuses still blocks checkout. What the
 * dropdowns buy is the end of typos and spelling variants — which was most of what went wrong with
 * free-text city names, since JRS has to string-match them to a zone.
 *
 * The names are normalised to JRS's spelling at generation time ("City of Makati" → "Makati City",
 * NCR → a "Metro Manila" province); see the sync script for why and how that was established.
 *
 * The barangay set is deliberately NEVER sent to the browser whole — the Server Actions in
 * `(store)/actions.ts` hand back only the selected city's, which is a few dozen.
 */

import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The shape written by `scripts/sync-locations.ts`. */
type LocationData = {
  /** ISO timestamp of the sync, for working out how stale this is. */
  syncedAt: string;
  /** Province name → municipality name → barangay names. */
  provinces: Record<string, Record<string, string[]>>;
};

const EMPTY: LocationData = { syncedAt: "", provinces: {} };

/**
 * Read once per process, then held.
 *
 * `readFileSync` rather than an `import` of the JSON: the file is ~1-2 MB and importing it would
 * bake it into the server bundle for every route, not just the two that use it.
 */
let cached: LocationData | undefined;

function data(): LocationData {
  if (cached) return cached;

  try {
    const raw = readFileSync(join(process.cwd(), "data", "ph-locations.json"), "utf8");
    const parsed = JSON.parse(raw) as LocationData;
    cached =
      parsed && typeof parsed === "object" && parsed.provinces ? parsed : EMPTY;
  } catch {
    // Missing or malformed is survivable: the dropdowns render empty and checkout can't proceed,
    // which is loud enough to notice. Crashing the route would be louder but no more useful.
    console.error(
      "[locations] data/ph-locations.json is missing or unreadable — " +
        "run `npm run sync:locations` to generate it.",
    );
    cached = EMPTY;
  }

  return cached;
}

/** When the snapshot was taken, or "" if there isn't one. */
export function locationsSyncedAt(): string {
  return data().syncedAt;
}

// Every list below is already A–Z: the sync script sorts once at generation time so that reads —
// which happen per request, per dropdown — do no work beyond a key lookup.

/** Every province, plus "Metro Manila" standing in for NCR. */
export function getProvinces(): string[] {
  return Object.keys(data().provinces);
}

/** Municipalities within a province. Unknown province → []. */
export function getCities(province: string): string[] {
  return Object.keys(data().provinces[province] ?? {});
}

/** Barangays within a municipality. Unknown province or city → []. */
export function getBarangays(province: string, city: string): string[] {
  return data().provinces[province]?.[city] ?? [];
}

/**
 * Is this a real province/city pair?
 *
 * NOT a serviceability check — we have no list of where JRS delivers, so this only rules out
 * addresses that don't exist. `getrate` is what decides whether a real place can be shipped to, and
 * it runs a moment later; this exists to catch a malformed pair with a message the customer can act
 * on, rather than letting it surface as an opaque courier failure.
 *
 * The dropdowns only offer real pairs, but a Server Action is a public HTTP endpoint and the form
 * posts plain strings — so `placeOrderAction` re-checks rather than trusting the browser used the
 * UI it was given.
 *
 * FAILS OPEN when there is no snapshot: a missing data file must not take every order down, and it
 * doesn't need to, because `getrate` still stands behind it.
 */
export function isKnownLocation(province: string, city: string): boolean {
  const { provinces } = data();
  if (Object.keys(provinces).length === 0) return true;
  return Boolean(provinces[province]?.[city]);
}
