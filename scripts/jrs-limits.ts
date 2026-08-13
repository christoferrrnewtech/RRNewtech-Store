/**
 * Measure JRS's real packaging behaviour, ONE PACKAGING AT A TIME — `npm run jrs:limits:*`.
 *
 * Deliberately small and gentle: ~15 requests per packaging, one at a time, 600 ms apart. Each run
 * merges its findings into `data/jrs-tariff.json`, so the five can be run minutes or days apart and
 * still be compared afterwards with `--compare`. Nothing here needs to be done in one sitting.
 *
 * A 429 ABORTS IMMEDIATELY and is never retried — retrying a rate limit is how a warning becomes a
 * block. Failures that aren't rate limits get exactly one retry.
 *
 * THE FOOTPRINTS ARE KNOWN, from JRS's published figures (see PACKAGING below), so this doesn't
 * search for them — it checks one centimetre either side of each stated edge to confirm where
 * excess actually starts.
 *
 * WHAT IS NOT KNOWN, and is the real reason this exists:
 *
 *  1. THICKNESS. JRS publishes two dimensions for the pouches and says nothing about depth. The
 *     5 / 7 / 10 cm lids in `jrs-packaging.ts` came from the original brief, not from JRS. If they
 *     are invented we are stepping parcels up a size — and paying a higher base rate — for nothing.
 *
 *  2. WEIGHT IS A TIER, NOT A CAP. "Minimum charge for the 1st 500 grams. Additional charge for
 *     succeeding 500 grams" reads as a surcharge, not a refusal, but our code treats it as "doesn't
 *     fit, use a bigger box". Whether stepping up actually beats the surcharge is a question only
 *     the tariff can answer, so that is what the weight phase asks.
 *
 *     npm run jrs:limits:letter          # ~15 requests, about 10 seconds
 *     npm run jrs:limits:1lb
 *     npm run jrs:limits:3lb
 *     npm run jrs:limits:5lb
 *     npm run jrs:limits:bulilit
 *     npm run jrs:limits -- --compare    # cross-box table, no requests at all
 *
 *     ... -- --phase thickness           # just one phase
 *     ... -- --delay 1500                # slower still
 *     ... -- --to "Davao City, Davao del Sur"
 *
 * Needs JRS_API_KEY in .env.local. Writes only `data/jrs-tariff.json`.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TARIFF = join(ROOT, "data", "jrs-tariff.json");

// ── Load .env.local into process.env (same parser the seed script uses) ──────────────────────
function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : "");
const only = flag("--only");
const phase = flag("--phase");
const destination = flag("--to") || "Cebu City, Cebu";
const compareOnly = args.includes("--compare");
const ratiosOnly = args.includes("--ratios");
/** Override the weight probe points, e.g. `--weights 5000,10000,20000`. */
const customWeights = flag("--weights")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter((w) => Number.isFinite(w) && w > 0);
/** Slow by default. The whole point of this rewrite is not tripping a rate limit. */
const DELAY_MS = Number(flag("--delay")) || 600;

const runFootprint = !phase || phase === "footprint";
const runThickness = !phase || phase === "thickness";
const runWeight = !phase || phase === "weight";

/**
 * JRS's published packaging, in their own units.
 *
 * `first`/`step` are the weight TIERS from the same page: the first N grams are covered by the base
 * rate, each further `step` grams adds a surcharge. Kept as JRS states them rather than translated
 * into a cap, because whether they behave as caps is exactly what the weight phase tests.
 */
const PACKAGING = [
  { key: "letter", name: "Express Letter", inches: "9.5×6.3", long: 24.13, short: 16.0, depth: 0, first: 100, step: 100 },
  { key: "1lb", name: "1 Pounder", inches: "15×11", long: 38.1, short: 27.94, depth: 0, first: 500, step: 500 },
  { key: "3lb", name: "3 Pounder", inches: "18×14", long: 45.72, short: 35.56, depth: 0, first: 1500, step: 500 },
  { key: "5lb", name: "5 Pounder", inches: "20×14", long: 50.8, short: 35.56, depth: 0, first: 2500, step: 500 },
  // The only one JRS publishes a depth for — a real box, not a pouch.
  { key: "bulilit", name: "Bulilit Box", inches: "11.5×8×4", long: 29.21, short: 20.32, depth: 10.16, first: 2500, step: 500 },
] as const;

/** Far inside every packaging, so it never contributes to the excess being measured. */
const MIN_CM = 1;

type Probe = { length: number; width: number; height: number; weight: number };
type Quote = { baseRate: number; excess: number; total: number };
type Reading = { at: number; excess: number; total: number; baseRate: number };
type BoxResult = {
  name: string;
  probedAt: string;
  destination: string;
  footprint?: { long: Reading[]; short: Reading[] };
  thickness?: Reading[];
  weight?: Reading[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

/** Thrown on a 429 so every caller unwinds instead of continuing to knock. */
class RateLimited extends Error {}

/**
 * Keyed by DESTINATION first, then packaging.
 *
 * Rates are zone-dependent, so a Davao run and a Cebu run are different measurements of different
 * things. Flat storage let the second one overwrite the first — silently destroying the readings
 * the cost model in `jrs-packaging.ts` is validated against.
 */
type Tariff = Record<string, Record<string, BoxResult>>;

function readTariff(): Tariff {
  try {
    return JSON.parse(readFileSync(TARIFF, "utf8")) as Tariff;
  } catch {
    return {};
  }
}

function writeTariff(all: Tariff) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(TARIFF, JSON.stringify(all, null, 2) + "\n");
}

/** The cross-box view — the whole reason results are accumulated rather than just printed. */
function compare(all: Tariff, dest: string) {
  const zone = all[dest] ?? {};
  const boxes = PACKAGING.filter((p) => zone[p.name]?.weight?.length);
  if (boxes.length < 2) {
    console.log(
      `\nOnly ${boxes.length} packaging probed so far. Run the rest, then \`npm run jrs:limits -- --compare\`.\n`,
    );
    return;
  }

  console.log(`\n══ Total cost by weight (${dest})`);
  console.log(`   Comparable only where the parcel physically FITS — a 5 Pounder rate is no use`);
  console.log(`   for something that doesn't fit a 3 Pounder's footprint.\n`);

  const grams = [...new Set(boxes.flatMap((b) => zone[b.name].weight!.map((r) => r.at)))].sort(
    (a, b) => a - b,
  );
  console.log(`   ${"grams".padStart(7)}  ${boxes.map((b) => b.name.padStart(16)).join("")}`);
  for (const g of grams) {
    const cells = boxes.map((b) => {
      const row = zone[b.name].weight!.find((r) => r.at === g);
      return (row ? `₱${row.total.toFixed(0)}${row.excess > 0 ? "*" : " "}` : "—").padStart(16);
    });
    console.log(`   ${String(g).padStart(7)}  ${cells.join("")}`);
  }
  console.log(`\n   * = includes an excess surcharge.`);
  console.log(
    `\n   If a BIGGER box is CHEAPER at a given weight, stepping up beats the surcharge and\n` +
      `   packagingForCart is right to do it. If it is dearer, the weight caps in JRS_PACKAGING\n` +
      `   are costing money and should come out.\n`,
  );
}

/**
 * Do the zones rank the boxes the same way? — `npm run jrs:limits -- --ratios`
 *
 * The cost model in `jrs-packaging.ts` holds Cebu-measured pesos and uses them only to decide which
 * box is cheaper. That is valid exactly as long as a zone scales the whole tariff rather than
 * reshuffling it. This prints each destination's base rates normalised against its own Express
 * Letter: if the columns match across zones, the ranking is zone-independent and the model is safe
 * everywhere. Reads what's already been probed — no requests.
 */
function ratios(all: Tariff) {
  const zones = Object.keys(all).filter((z) =>
    PACKAGING.every((p) => all[z][p.name]?.weight?.length),
  );
  if (zones.length < 2) {
    console.log(
      `\nNeed two fully-probed destinations to compare; have ${zones.length}` +
        `${zones.length ? ` (${zones.join(", ")})` : ""}.\n` +
        `Run: npm run jrs:limits -- --phase weight --to "Davao City, Davao del Sur"\n`,
    );
    return;
  }

  console.log(`\n══ Base rate by zone, normalised to each zone's own Express Letter\n`);
  console.log(`   ${"packaging".padEnd(16)}${zones.map((z) => z.padStart(24)).join("")}`);

  const baseOf = (zone: string, name: string) => all[zone][name].weight![0].baseRate;
  let consistent = true;

  for (const box of PACKAGING) {
    const cells = zones.map((z) => {
      const ratio = baseOf(z, box.name) / baseOf(z, "Express Letter");
      return `${baseOf(z, box.name).toFixed(0)}  (×${ratio.toFixed(3)})`.padStart(24);
    });
    console.log(`   ${box.name.padEnd(16)}${cells.join("")}`);
  }

  // THE TEST THAT MATTERS is not whether the ratios match — they won't, since zones scale each box
  // a little differently — but whether that drift is ever enough to REORDER them. The model uses
  // these numbers only to pick a winner, so a zone is safe exactly as long as the winner is unchanged.
  //
  // Compared from MEASURED readings only, never extrapolated. An earlier version modelled the gaps
  // and reported four false disagreements, because it applied the pouches' stepped formula to the
  // Bulilit Box, which is banded. A script whose job is to validate a cost model has no business
  // assuming one.
  const readingAt = (zone: string, name: string, grams: number) => {
    const row = all[zone][name].weight!.find((r) => r.at === grams);
    return row ? row.baseRate + row.excess : undefined;
  };

  const allGrams = [
    ...new Set(zones.flatMap((z) => PACKAGING.flatMap((p) => all[z][p.name].weight!.map((r) => r.at)))),
  ].sort((a, b) => a - b);

  const disagreements: string[] = [];
  let compared = 0;

  for (const grams of allGrams) {
    // Only boxes every zone actually measured at this weight — anything else is guesswork.
    const usable = PACKAGING.filter((p) => zones.every((z) => readingAt(z, p.name, grams) !== undefined));
    if (usable.length < 2) continue;
    compared++;

    const picks = zones.map(
      (z) =>
        usable.reduce((best, p) =>
          readingAt(z, p.name, grams)! < readingAt(z, best.name, grams)! ? p : best,
        ).name,
    );
    if (new Set(picks).size > 1) {
      consistent = false;
      disagreements.push(
        `${grams} g (of ${usable.length}): ${zones.map((z, i) => `${z} → ${picks[i]}`).join(" · ")}`,
      );
    }
  }

  for (const line of disagreements) console.log(`   ✗ ${line}`);
  console.log(
    `\n   Compared at ${compared} weight(s) where every zone has a real reading for 2+ boxes.`,
  );

  console.log(
    consistent
      ? `\n   ✓ Every zone picks the SAME cheapest box at every weight, so the Cebu-based cost\n` +
          `     model in jrs-packaging.ts is safe to use nationwide. (Per-box ratios drift a little\n` +
          `     between zones — that is fine, and expected; it just never reorders them.)\n`
      : `\n   ✗ The ratios DIFFER across zones — a zone can rank the boxes differently, so a single\n` +
          `     hardcoded cost model will pick a costlier box somewhere. jrs-packaging.ts needs a\n` +
          `     per-zone table, or the choice needs to be made from a live quote.\n`,
  );
}

async function main() {
  const all = readTariff();

  if (compareOnly) {
    compare(all, destination);
    return;
  }

  if (ratiosOnly) {
    ratios(all);
    return;
  }

  if (!process.env.JRS_API_KEY) {
    console.error("Missing JRS_API_KEY — add it to .env.local (see .env.example).");
    process.exit(1);
  }

  const { API_URL, RATE_ORIGIN, rateRequestBody } = await import("../src/lib/jrs-protocol");

  const boxes = only
    ? PACKAGING.filter((p) => p.name.toLowerCase() === only.toLowerCase() || p.key === only)
    : PACKAGING;

  if (boxes.length === 0) {
    console.error(
      `\nNo packaging "${only}". Known: ${PACKAGING.map((p) => `${p.name} (${p.key})`).join(", ")}\n`,
    );
    process.exit(1);
  }

  async function quote(packagingName: string, p: Probe, attempt = 1): Promise<Quote | undefined> {
    requests++;
    await sleep(DELAY_MS);

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": process.env.JRS_API_KEY!,
        },
        body: JSON.stringify({
          requestType: "getrate",
          apiShippingRequest: rateRequestBody({
            recipient: destination,
            packagingName,
            shipmentItems: [{ declaredValue: 100, ...p }],
          }),
        }),
      });
    } catch (err) {
      // Network-level only — a transport blip is worth one retry.
      if (attempt === 1) return quote(packagingName, p, 2);
      console.log(`      request failed: ${err instanceof Error ? err.message : err}`);
      return undefined;
    }

    // NEVER retried. Knocking again is how a rate limit becomes a ban.
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new RateLimited(
        `JRS rate-limited us (429)${retryAfter ? ` — retry after ${retryAfter}s` : ""}`,
      );
    }

    if (!response.ok) {
      const body = (await response.text()).slice(0, 120);
      // A 4xx is the request being wrong; it will be just as wrong a second later.
      if (response.status < 500 || attempt === 2) {
        console.log(`      HTTP ${response.status} ${body}`);
        return undefined;
      }
      return quote(packagingName, p, 2);
    }

    const raw: Record<string, unknown> = JSON.parse(await response.text());
    const n = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
    return { baseRate: n(raw.BaseRate), excess: n(raw.Excess), total: n(raw.TotalShippingRate) };
  }

  const perBox = (runFootprint ? 6 : 0) + (runThickness ? 5 : 0) + (runWeight ? 4 : 0);
  console.log(`\nJRS packaging probe`);
  console.log(`  from ${RATE_ORIGIN}  →  to ${destination}`);
  console.log(
    `  ${boxes.length} packaging × ~${perBox} requests, ${DELAY_MS} ms apart ` +
      `— about ${Math.ceil((boxes.length * perBox * DELAY_MS) / 1000)}s\n`,
  );

  for (const box of boxes) {
    console.log(`══ ${box.name}  (${box.inches}" = ${box.long}×${box.short} cm, first ${box.first} g)`);

    // Phases not run this time carry forward, so `--phase weight` doesn't wipe an earlier
    // footprint pass. Safe now that storage is keyed by destination — a different zone lands in a
    // different bucket rather than on top of this one.
    const zone = (all[destination] ??= {});
    const result: BoxResult = {
      ...zone[box.name],
      name: box.name,
      probedAt: new Date().toISOString(),
      destination,
    };
    // Held inside its own first tier, so weight never contributes to excess attributed to size.
    const tierWeight = Math.max(1, box.first - 1);

    // ── Footprint: one centimetre either side of each published edge ─────────────────────────
    if (runFootprint) {
      console.log(`  footprint — weight held at ${tierWeight} g`);
      const readings: { long: Reading[]; short: Reading[] } = { long: [], short: [] };

      for (const edge of ["long", "short"] as const) {
        const line: string[] = [];
        for (const delta of [-1, 0, 1]) {
          const at = Math.round((box[edge] + delta) * 100) / 100;
          const p: Probe =
            edge === "long"
              ? { length: at, width: MIN_CM, height: MIN_CM, weight: tierWeight }
              : { length: MIN_CM, width: at, height: MIN_CM, weight: tierWeight };
          const q = await quote(box.name, p);
          if (q) readings[edge].push({ at, ...q });
          line.push(q ? `${at}${delta === 0 ? "*" : ""}:${q.excess === 0 ? "ok" : `+${q.excess}`}` : `${at}:?`);
        }
        console.log(`    ${edge.padEnd(5)} ${line.join("   ")}`);
      }
      result.footprint = readings;
      console.log(`    (* = JRS's published edge · "ok" = no excess · "+n" = n pesos of excess)`);
    }

    // ── Thickness: is there a depth limit at all? ─────────────────────────────────────────────
    if (runThickness) {
      const readings: Reading[] = [];
      const line: string[] = [];
      for (const height of [1, 5, 7, 10, 20]) {
        const q = await quote(box.name, {
          length: MIN_CM,
          width: MIN_CM,
          height,
          weight: tierWeight,
        });
        if (q) readings.push({ at: height, ...q });
        line.push(q ? `${height}:${q.excess === 0 ? "ok" : `+${q.excess}`}` : `${height}:?`);
      }
      result.thickness = readings;
      console.log(`  thickness (cm) — ${box.depth ? `${box.depth} cm published` : "none published"}`);
      console.log(`    ${line.join("   ")}`);
    }

    // ── Weight: the tariff across the tiers ───────────────────────────────────────────────────
    if (runWeight) {
      const readings: Reading[] = [];
      console.log(`  weight — base covers the first ${box.first} g, then +${box.step} g steps`);
      const points = customWeights.length
        ? customWeights
        : [box.first, box.first + box.step, box.first + box.step * 2, box.first + box.step * 4];
      for (const at of points) {
        const q = await quote(box.name, {
          length: MIN_CM,
          width: MIN_CM,
          height: MIN_CM,
          weight: at,
        });
        if (!q) continue;
        readings.push({ at, ...q });
        console.log(
          `    ${String(at).padStart(6)} g   base ₱${q.baseRate.toFixed(2).padStart(8)}` +
            `   excess ₱${q.excess.toFixed(2).padStart(8)}   total ₱${q.total.toFixed(2).padStart(8)}`,
        );
      }
      // Merged by weight, not replaced: `--weights 5000,10000` is meant to EXTEND the record,
      // and a plain assignment silently discarded the tier readings a previous run had captured.
      const byGram = new Map((result.weight ?? []).map((r) => [r.at, r]));
      for (const r of readings) byGram.set(r.at, r);
      result.weight = [...byGram.values()].sort((a, b) => a.at - b.at);
    }

    // Saved per box, so an interrupted run keeps whatever it already learned.
    zone[box.name] = result;
    writeTariff(all);
    console.log("");
  }

  console.log(`${requests} requests · saved to ${TARIFF.replace(ROOT + "/", "")}`);
  const done = PACKAGING.filter((p) => all[destination]?.[p.name]?.weight?.length).length;
  console.log(
    done === PACKAGING.length
      ? `All ${done} packaging probed — run \`npm run jrs:limits -- --compare\` for the cost table.\n`
      : `${done}/${PACKAGING.length} packaging probed so far.\n`,
  );
}

main().catch((err) => {
  if (err instanceof RateLimited) {
    console.error(`\n${err.message}`);
    console.error(
      `Stopped after ${requests} requests. Whatever finished is saved — re-run the same\n` +
        `command later with a bigger --delay to continue.\n`,
    );
    process.exit(1);
  }
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
