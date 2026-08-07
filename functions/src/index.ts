/**
 * Scheduled maintenance for the storefront.
 *
 * The Next.js app on App Hosting owns every user-facing path — checkout, the PayMongo webhook,
 * the admin. This codebase exists only for work that has to happen when nobody is looking.
 *
 * See ./sweep-expired-payments.ts for the one job it runs today.
 */

import {setGlobalOptions} from "firebase-functions";

// asia-southeast1 to match the App Hosting backend and the Firestore database — a sweep that
// crosses regions to read its own project's data would be slower and cost egress for nothing.
//
// maxInstances 1: this is a scheduled job, not a request handler. There is never a reason for two
// copies to run at once, and capping it removes any chance of two overlapping sweeps racing over
// the same orders (the transaction would make that safe, but not free).
setGlobalOptions({region: "asia-southeast1", maxInstances: 1});

export {sweepExpiredPayments} from "./sweep-expired-payments";
