/**
 * Generate `data/ph-locations.json` from the PSA's PSGC — `npm run sync:locations`.
 *
 * Source: https://psgc.gitlab.io/api — a mirror of the Philippine Standard Geographic Code, the
 * PSA's official list of every region, province, city/municipality and barangay in the country.
 *
 * WHY NOT JRS: they don't publish a serviceable-area list. So this dataset answers "is this a real
 * Philippine address?", NOT "will JRS deliver there?" — `getrate` remains the only authority on the
 * second question, and an address that JRS refuses still blocks checkout. What the dropdowns buy is
 * the elimination of typos and free-text spelling variants, which is most of what went wrong.
 *
 * THE NAMES ARE NORMALISED, and that is the whole reason this is a script rather than a download.
 * PSGC and JRS disagree about what places are called:
 *
 *   PSGC                       JRS (confirmed from a live rate response)
 *   "City of Makati"           "Makati City"
 *   NCR, no province at all    province "Metro Manila"
 *
 * We know JRS's spelling because a rate we sent as "Makati City, Metro Manila" came back with
 * `"OriginMunicipal": "Makati City", "OriginProvince": "Metro Manila"`. Getting this wrong doesn't
 * fail loudly — it produces addresses that look fine and can't be rated.
 *
 * Run it when the PSGC publishes an update (roughly yearly). Output is ~1 MB, committed, and read
 * by `src/lib/locations.ts`.
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "ph-locations.json");
const API = "https://psgc.gitlab.io/api";

/** PSGC region code for the National Capital Region. */
const NCR = "130000000";

/**
 * Cities that belong to no province in the PSGC and aren't in NCR either.
 *
 * Both are historical administrative oddities — independent chartered cities that sit inside a
 * province without being part of it. JRS almost certainly files them under the province that
 * surrounds them, so that's what we send. If a rate for one of these ever fails, this table is the
 * first place to look.
 *
 * Each value MUST be a province the PSGC already knows — the check at the end of this script
 * enforces it. Writing "Maguindanao del Norte" here (the post-2022 split, which this PSGC snapshot
 * has not adopted) silently created a phantom province containing exactly one city.
 */
const PROVINCE_OVERRIDES: Record<string, string> = {
  "City of Isabela": "Basilan",
  "City of Cotabato": "Maguindanao",
};

type Region = { code: string; name: string };
type Province = { code: string; name: string; regionCode: string };
type City = {
  code: string;
  name: string;
  provinceCode: string | false;
  regionCode: string;
};
type Barangay = {
  name: string;
  cityCode: string | false;
  municipalityCode: string | false;
};

async function get<T>(path: string): Promise<T> {
  process.stdout.write(`  fetching ${path}… `);
  const response = await fetch(`${API}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const json = (await response.json()) as T;
  console.log(`${Array.isArray(json) ? json.length : "?"} rows`);
  return json;
}

/**
 * PSGC's formal name → the everyday name JRS uses.
 *
 * "City of Makati" → "Makati City". Names already in that form ("Quezon City", "Pasay City") and
 * plain municipalities ("Adams") pass through untouched.
 */
function cityName(name: string): string {
  const asCity = /^City of (.+)$/.exec(name);
  if (asCity) return `${asCity[1]} City`;
  const asMunicipality = /^Municipality of (.+)$/.exec(name);
  if (asMunicipality) return asMunicipality[1];
  return name;
}

async function main() {
  console.log(`\nBuilding ${OUT.replace(ROOT + "/", "")} from ${API}\n`);

  const [regions, provinceRows, cityRows, barangayRows] = await Promise.all([
    get<Region[]>("regions.json"),
    get<Province[]>("provinces.json"),
    get<City[]>("cities-municipalities.json"),
    get<Barangay[]>("barangays.json"),
  ]);

  void regions;
  const provinceByCode = new Map(provinceRows.map((p) => [p.code, p.name]));
  const provinceNames = new Set(provinceRows.map((p) => p.name));

  // An override naming a province the PSGC doesn't have doesn't fail — it quietly invents a new
  // one holding a single city, which then appears in the dropdown as a province nobody recognises.
  for (const [city, province] of Object.entries(PROVINCE_OVERRIDES)) {
    if (!provinceNames.has(province)) {
      console.error(
        `\nPROVINCE_OVERRIDES maps "${city}" to "${province}", which is not a PSGC province.\n` +
          `This snapshot has: ${provinceRows
            .map((p) => p.name)
            .filter((n) => n.split(" ")[0] === province.split(" ")[0])
            .join(", ") || "(nothing similar)"}\n`,
      );
      process.exit(1);
    }
  }

  // ── Cities, resolved to a province ────────────────────────────────────────────────────────
  const provinces: Record<string, Record<string, string[]>> = {};
  /** PSGC city code → where we filed it, so barangays can find their way back. */
  const placed = new Map<string, { province: string; city: string }>();
  const orphans: string[] = [];

  for (const row of cityRows) {
    const province = row.provinceCode
      ? provinceByCode.get(row.provinceCode)
      : row.regionCode === NCR
        ? "Metro Manila"
        : PROVINCE_OVERRIDES[row.name];

    if (!province) {
      orphans.push(row.name);
      continue;
    }

    const city = cityName(row.name);
    (provinces[province] ??= {})[city] = [];
    placed.set(row.code, { province, city });
  }

  // ── Barangays ─────────────────────────────────────────────────────────────────────────────
  let barangayCount = 0;
  let unplacedBarangays = 0;

  for (const row of barangayRows) {
    const code = row.cityCode || row.municipalityCode;
    const target = code ? placed.get(code) : undefined;
    if (!target) {
      unplacedBarangays++;
      continue;
    }
    provinces[target.province][target.city].push(row.name);
    barangayCount++;
  }

  // Sorted at build time so every read is already ordered — `locations.ts` does no work per request.
  for (const cities of Object.values(provinces)) {
    for (const key of Object.keys(cities)) {
      cities[key] = [...new Set(cities[key])].sort((a, b) => a.localeCompare(b));
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(provinces)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([province, cities]) => [
        province,
        Object.fromEntries(Object.entries(cities).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  );

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        source: `${API} (PSA Philippine Standard Geographic Code)`,
        provinces: sorted,
      },
      null,
      0,
    ) + "\n",
  );

  const cityTotal = Object.values(sorted).reduce((n, c) => n + Object.keys(c).length, 0);
  const kb = (readFileSync(OUT).byteLength / 1024).toFixed(0);

  console.log(
    `\nWrote ${Object.keys(sorted).length} provinces, ${cityTotal} cities/municipalities, ` +
      `${barangayCount} barangays — ${kb} KB`,
  );

  // Sanity checks on the normalisation, because a silently wrong name is the failure mode here.
  const ncr = sorted["Metro Manila"] ?? {};
  console.log("\nNormalisation spot-checks:");
  for (const expected of ["Makati City", "Quezon City", "Manila City", "Taguig City"]) {
    console.log(`  ${expected in ncr ? "✓" : "✗"} Metro Manila → ${expected}`);
  }
  console.log(`  ${"Cebu" in sorted ? "✓" : "✗"} Cebu province present`);
  console.log(`  ${"Cebu City" in (sorted["Cebu"] ?? {}) ? "✓" : "✗"} Cebu → Cebu City`);

  if (orphans.length) {
    console.log(`\n${orphans.length} city/cities had no province and were DROPPED:`);
    for (const name of orphans) console.log(`  · ${name}`);
    console.log("  Add them to PROVINCE_OVERRIDES in this script.");
  }
  if (unplacedBarangays) {
    console.log(`\n${unplacedBarangays} barangay(s) had no resolvable city and were dropped.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
