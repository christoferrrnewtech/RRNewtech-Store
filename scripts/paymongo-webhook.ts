/**
 * Fire a correctly-signed PayMongo webhook at a running dev server.
 *
 * PayMongo cannot reach localhost, and a tunnel is a lot of setup for something you want to run
 * fifty times. This signs a payload with the same HMAC scheme the real gateway uses, so it
 * exercises the ENTIRE handler — header parsing, test/live component selection, the constant-time
 * compare, session extraction, the idempotency claim, and the payment transaction.
 *
 * Run the dev server, then:
 *
 *     npm run webhook:test -- --session cs_abc123 --order <firestoreDocId>
 *     npm run webhook:test -- --order <firestoreDocId> --event payment.failed
 *
 * Flags:
 *   --order    Firestore document id of the order (goes into metadata.orderId). Required.
 *   --session  Checkout session id. Defaults to the order's, if you pass one; else a fake.
 *   --event    checkout_session.payment.paid (default) | payment.failed
 *   --id       Event id. Reuse the SAME id twice to prove idempotency.
 *   --url      Target. Defaults to http://localhost:3000/api/paymongo/webhook
 *   --secret   Override PAYMONGO_WEBHOOK_SECRET (e.g. to prove a bad signature is rejected).
 *
 * Reads PAYMONGO_WEBHOOK_SECRET and PAYMONGO_SECRET_KEY from .env.local. The secret key is read
 * only to decide test vs live mode, matching what the route does.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

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

function flag(name: string, fallback = ""): string {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const orderId = flag("order");
if (!orderId) {
  console.error("Missing --order <firestoreDocId>. See the header of this file.");
  process.exit(1);
}

const secret = flag("secret", process.env.PAYMONGO_WEBHOOK_SECRET ?? "");
if (!secret) {
  console.error("No webhook secret — set PAYMONGO_WEBHOOK_SECRET in .env.local or pass --secret.");
  process.exit(1);
}

const sessionId = flag("session", `cs_test_${crypto.randomBytes(8).toString("hex")}`);
const eventType = flag("event", "checkout_session.payment.paid");
const eventId = flag("id", `evt_test_${crypto.randomBytes(8).toString("hex")}`);
const url = flag("url", "http://localhost:3000/api/paymongo/webhook");

const paid = eventType.endsWith(".paid");
const nowSeconds = Math.floor(Date.now() / 1000);

// Mirrors the nesting the route's extractor probes for.
const payload = {
  data: {
    id: eventId,
    type: "event",
    attributes: {
      type: eventType,
      livemode: false,
      created_at: nowSeconds,
      data: {
        id: sessionId,
        type: "checkout_session",
        attributes: {
          status: "active",
          reference_number: "RR-TEST01",
          metadata: { orderId, ref: "RR-TEST01" },
          paid_at: paid ? nowSeconds : 0,
          payments: [
            {
              id: `pay_test_${crypto.randomBytes(6).toString("hex")}`,
              type: "payment",
              attributes: {
                status: paid ? "paid" : "failed",
                paid_at: paid ? nowSeconds : 0,
                source: { type: "gcash" },
              },
            },
          ],
        },
      },
    },
  },
};

const body = JSON.stringify(payload);
const timestamp = String(nowSeconds);
const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

// The route picks `te` in test mode and `li` in live mode, from the secret KEY's prefix.
const live = process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_");
const header = live
  ? `t=${timestamp},te=${"0".repeat(64)},li=${signature}`
  : `t=${timestamp},te=${signature},li=${"0".repeat(64)}`;

async function main() {
  console.log(`POST ${url}`);
  console.log(`  event   ${eventType}  (${eventId})`);
  console.log(`  session ${sessionId}`);
  console.log(`  order   ${orderId}`);
  console.log(`  mode    ${live ? "live" : "test"}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paymongo-Signature": header },
    body,
  });

  console.log(`\n→ ${response.status} ${await response.text()}`);
  // Non-2xx is a legitimate outcome when you're testing rejection paths, so don't exit non-zero.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
