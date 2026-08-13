/**
 * Expire abandoned PayMongo checkout sessions.
 *
 * WHY THIS EXISTS. The storefront gives a customer one hour to finish paying (see
 * `src/lib/pay-window.ts` in the app). `/checkout/pay` enforces that lazily — it expires the
 * session when a customer comes back too late. But a customer who leaves the PayMongo tab open and
 * never revisits the store is invisible to that path, and PayMongo's create-session API has no
 * expiry attribute to set up front (checked against their docs: the request accepts billing,
 * cancel_url, capture_type, customer_email, customer_id, description, line_items, merchant,
 * metadata, origin, pass_on_fees, payment_method_types, reference_number, send_email_receipt,
 * show_description, show_line_items, split_payment, statement_descriptor, success_url — and
 * nothing that sets a lifetime). So the only way to actually close a lapsed session is to go
 * looking for it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never touches an order that is paid, failed or already
 * expired, and it never moves anything *to* paid. Its whole authority is one transition:
 * `awaiting_payment → expired`, re-checked inside a transaction. That narrowness is the point —
 * `applyOrderPayment` in `src/lib/orders.ts` remains the source of truth for the full payment state
 * machine, and this job is a strict subset of it that cannot contradict it. If you find yourself
 * wanting to widen what this writes, put the logic there and call it from the app instead.
 *
 * COST. Every 15 minutes is 2,880 runs a month against a 2,000,000 free-tier allowance, and an
 * idle run is a single Firestore read. Effectively free; the cadence is set by how quickly you
 * want a lapsed session closed, not by budget.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

/**
 * Same Secret Manager entry the App Hosting backend uses, but the grant is separate — the
 * functions runtime has its own service account. If deploys succeed and this logs
 * "not configured", that grant is what is missing.
 */
const paymongoSecretKey = defineSecret("PAYMONGO_SECRET_KEY");

/** Must match COLLECTIONS.orders in src/lib/firebase.ts. */
const ORDERS = "storeOrders";

/** v1 throughout, matching src/lib/paymongo.ts. */
const API_BASE = "https://api.paymongo.com/v1";

/**
 * A ceiling per run, not a target. A backlog drains over subsequent runs rather than one
 * invocation trying to make hundreds of gateway calls inside its timeout.
 */
const MAX_PER_RUN = 200;

/** Gateway calls are best-effort; a hung one must not eat the whole run's budget. */
const REQUEST_TIMEOUT_MS = 10_000;

if (!getApps().length) initializeApp();

/**
 * Tell PayMongo the session is over.
 *
 * Returns false rather than throwing on a 4xx, because every documented refusal — already
 * expired, has a paid payment, has one in flight — is a NORMAL outcome here. In particular
 * "has a paid payment" means the customer beat us to it, and the webhook will have recorded that;
 * the transaction below re-reads and leaves such an order alone.
 */
async function expireSession(
  sessionId: string,
  secretKey: string,
): Promise<boolean> {
  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  try {
    const response = await fetch(
      `${API_BASE}/checkout_sessions/${encodeURIComponent(sessionId)}/expire`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    return response.ok;
  } catch (err) {
    logger.warn("could not expire session at PayMongo", {sessionId, err});
    return false;
  }
}

/**
 * Flip one order, transactionally.
 *
 * Re-reads inside the transaction rather than trusting the query snapshot, which may be seconds
 * stale — long enough for the webhook to have marked the order paid in between. Only
 * `awaiting_payment` is touched, so a paid, failed or already-expired order is left exactly as it
 * is. Returns whether anything changed.
 */
async function markExpired(orderId: string): Promise<boolean> {
  const ref = getFirestore().collection(ORDERS).doc(orderId);
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    if ((snap.data() ?? {}).paymentStatus !== "awaiting_payment") return false;
    tx.update(ref, {paymentStatus: "expired"});
    return true;
  });
}

export const sweepExpiredPayments = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Asia/Manila",
    secrets: [paymongoSecretKey],
    timeoutSeconds: 300,
    retryCount: 0,
  },
  async () => {
    const secretKey = paymongoSecretKey.value();
    if (!secretKey) {
      // Matches the app's invariant that everything runs with PayMongo unconfigured.
      logger.info("PAYMONGO_SECRET_KEY not configured — nothing to sweep");
      return;
    }

    const now = Date.now();

    // `checkoutExpiresAt > 0` is load-bearing, not defensive noise. Orders written before the
    // payment window existed store 0, and the app reads 0 as "no window, never expires" — without
    // this bound every one of them would be older than `now` and get expired on the first run.
    //
    // Needs a composite index on (paymentStatus ASC, checkoutExpiresAt ASC); it is declared in
    // firestore.indexes.json at the repo root.
    const snap = await getFirestore()
      .collection(ORDERS)
      .where("paymentStatus", "==", "awaiting_payment")
      .where("checkoutExpiresAt", ">", 0)
      .where("checkoutExpiresAt", "<", now)
      .limit(MAX_PER_RUN)
      .get();

    if (snap.empty) {
      logger.info("no lapsed checkouts");
      return;
    }

    let expired = 0;
    let sessionsClosed = 0;

    for (const doc of snap.docs) {
      const data = doc.data() ?? {};
      const sessionId =
        typeof data.checkoutSessionId === "string" ? data.checkoutSessionId : "";

      // Close it at the gateway FIRST. If the write succeeded but this didn't, the customer could
      // still pay a session our own records call dead — and while `expired → paid` is legal in the
      // app precisely so that money is never lost, it is a state nobody enjoys explaining.
      if (sessionId) {
        if (await expireSession(sessionId, secretKey)) sessionsClosed++;
      }

      try {
        if (await markExpired(doc.id)) expired++;
      } catch (err) {
        // One bad document must not abandon the rest of the batch; the next run retries it.
        logger.error("could not mark order expired", {orderId: doc.id, err});
      }
    }

    logger.info("sweep complete", {
      found: snap.size,
      expired,
      sessionsClosed,
      // Only ever a lower bound when a full batch comes back — the rest drains next run.
      truncated: snap.size === MAX_PER_RUN,
      sweptBefore: Timestamp.fromMillis(now).toDate().toISOString(),
    });
  },
);
