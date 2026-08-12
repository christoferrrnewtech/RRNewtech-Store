/**
 * Print a real JRS Express rate response — `npm run jrs:rate`.
 *
 * The response shape isn't documented anywhere we have, so `parseRate` in `src/lib/jrs-protocol.ts`
 * is written tolerantly and this script is how you replace that tolerance with certainty: it posts
 * one plausible cart, dumps the RAW body, and then shows what the parser made of it. Once you can
 * see the real field names, pin them at the top of the `pickNumber(...)` lists and delete the
 * guesses.
 *
 * It builds the request with `rateRequestBody()` and reads it with `parseRate()` — the SAME
 * functions checkout uses, so a green result here means checkout works. It does its own fetch
 * rather than calling `getJrsRate()`, because that lives behind `server-only`, which is supplied by
 * Next's bundler and doesn't resolve under `tsx`. The key handling is the only thing duplicated.
 *
 * Needs JRS_API_KEY in .env.local (see .env.example). Nothing is written anywhere — this only reads.
 *
 *     npm run jrs:rate                          # default: Cebu City, a small boxed parcel
 *     npm run jrs:rate -- "Davao City, Davao del Sur"
 *     npm run jrs:rate -- "Cebu City, Cebu" cargo   # omit productName, let JRS decide
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

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

if (!process.env.JRS_API_KEY) {
  console.error("Missing JRS_API_KEY — add it to .env.local (see .env.example).");
  process.exit(1);
}

async function main() {
  const { API_URL, RATE_ORIGIN, obj, parseRate, rateRequestBody } = await import(
    "../src/lib/jrs-protocol"
  );
  const { determineProductName } = await import("../src/lib/jrs-packaging");

  const recipient = process.argv[2] || "Cebu City, Cebu";
  const asCargo = process.argv[3] === "cargo";

  // Two units of a small boxed item — a realistic dental-consumables order.
  const unit = { declaredValue: 850, length: 20, width: 14, height: 3, weight: 400 };
  const shipmentItems = [unit, unit];

  const packagingName = asCargo
    ? undefined
    : determineProductName(
        shipmentItems.map(({ length, width, height, weight }) => ({
          length,
          width,
          height,
          weight,
        })),
      );

  const request = rateRequestBody({ recipient, shipmentItems, packagingName });

  console.log("\nRequest");
  console.log("  from        ", RATE_ORIGIN);
  console.log("  to          ", recipient);
  console.log("  items       ", shipmentItems.length, "unit(s)");
  console.log("  productName ", packagingName ?? "(omitted — General Cargo)");
  console.log("\nBody");
  console.log(JSON.stringify({ requestType: "getrate", apiShippingRequest: request }, null, 2));

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Ocp-Apim-Subscription-Key": process.env.JRS_API_KEY!,
    },
    body: JSON.stringify({ requestType: "getrate", apiShippingRequest: request }),
  });

  const raw = await response.text();

  console.log(`\nResponse — HTTP ${response.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(raw), null, 2));
  } catch {
    console.log(raw || "(empty body)");
  }

  if (!response.ok) {
    console.error("\nJRS refused the request. Checkout would block on this.\n");
    process.exit(1);
  }

  let body;
  try {
    body = obj(JSON.parse(raw));
  } catch {
    console.error("\nNot JSON — the parser can't read this. Checkout would block.\n");
    process.exit(1);
  }

  const rate = parseRate(body);
  console.log("\nParsed by src/lib/jrs-protocol.ts");
  console.log("  shippingCost ", rate.shippingCost ?? "(NOT FOUND)");
  console.log("  insuranceCost", rate.insuranceCost);
  console.log("  valuationCost", rate.valuationCost);

  if (rate.shippingCost === undefined) {
    console.error(
      "\nThe parser found no shipping cost — checkout WOULD BLOCK on this response." +
        "\nFind the real field name in the body above and add it to the pickNumber(...) list" +
        "\nin src/lib/jrs-protocol.ts.\n",
    );
    process.exit(1);
  }

  console.log(
    "\nGood — checkout can rate this. If the figures look wrong, pin the exact field names" +
      "\nin the pickNumber(...) lists in src/lib/jrs-protocol.ts and drop the guesses.\n",
  );
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
