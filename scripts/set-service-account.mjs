/**
 * Fill FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local from a downloaded Firebase
 * service-account JSON — so you don't have to hand-paste the multi-line private key.
 *
 * Usage:
 *   node scripts/set-service-account.mjs ~/Downloads/rnr-dental-clinics-firebase-adminsdk-XXXX.json
 *
 * The JSON is only read; it is never copied into the repo. Delete it afterwards.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: node scripts/set-service-account.mjs <path-to-service-account.json>");
  process.exit(1);
}
if (!existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!sa.client_email || !sa.private_key) {
  console.error("That JSON has no client_email/private_key — is it a service-account key?");
  process.exit(1);
}

const envPath = join(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local not found — run this from the project root.");
  process.exit(1);
}

// Store the private key on one line with literal \n (src/lib/firebase.ts converts them back).
const oneLineKey = sa.private_key.replace(/\r?\n/g, "\\n");

let env = readFileSync(envPath, "utf8");
function setVar(name, value) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
}

setVar("FIREBASE_CLIENT_EMAIL", sa.client_email);
setVar("FIREBASE_PRIVATE_KEY", `"${oneLineKey}"`);
if (sa.project_id) setVar("FIREBASE_PROJECT_ID", sa.project_id);

writeFileSync(envPath, env);
console.log("✓ Wrote FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to .env.local");
console.log(`  client_email: ${sa.client_email}`);
console.log("  You can delete the downloaded JSON now.");
