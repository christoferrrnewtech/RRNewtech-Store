/**
 * Firebase Admin SDK singleton — SERVER ONLY.
 *
 * This module talks to the `rnr-dental-clinics` Firestore project with full admin privileges
 * (it bypasses security rules), so it must never be imported from a `"use client"` component.
 * It backs the data helpers in `content.ts` / `products.ts` and the auth layer in `auth.ts`.
 *
 * Credentials come from a service account (Firebase console → Project settings → Service
 * accounts → Generate new private key), supplied via env vars — see `.env.example`.
 *
 * The store's data lives as documents INSIDE the existing `R&RLandingPage` collection — one
 * document per type, each holding its items as a map keyed by the natural id (banner id / slug /
 * uid). This matches how that collection already works (its `banner` doc holds data as fields).
 * Document ids are centralised in DOCS below so every caller uses the same string.
 */

import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/** The collection the store's documents live inside. */
export const LANDING = "R&RLandingPage";

/** Document ids inside `R&RLandingPage`, one per content type. */
export const DOCS = {
  banner: "banner",
  brand: "brand",
  product: "product",
  categories: "categories",
  users: "users",
  about: "about",
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Firebase is not configured — set the FIREBASE_* env vars in .env.local ` +
        `(see .env.example). Generate a service-account key in the Firebase console.`,
    );
  }
  return value;
}

function initAdminApp(): App {
  if (getApps().length) return getApp();

  // A service-account private key pasted into an env var keeps its literal "\n" sequences;
  // turn them back into real newlines so the PEM parses.
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey,
    }),
    // Optional — only needed for Firebase Storage image uploads.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

// Lazily initialise on first access so simply importing the module (e.g. during a build step that
// never touches Firestore) doesn't require credentials.
let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(initAdminApp());
    // Let writes send `undefined` optional fields without throwing — they're simply omitted.
    _db.settings({ ignoreUndefinedProperties: true });
  }
  return _db;
}

export function getAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(initAdminApp());
  return _auth;
}

/** A store document inside `R&RLandingPage` (e.g. storeDoc(DOCS.brand)). */
export function storeDoc(name: string) {
  return getDb().collection(LANDING).doc(name);
}

/**
 * Transactional records — one document per record, in their own top-level collections.
 *
 * Deliberately NOT the keyed-map-in-one-document shape used for CMS content above. That shape
 * suits a fixed handful of brands or banners; orders and inquiries grow without bound, and a
 * Firestore document is capped at 1 MiB. One document per record also means Firestore can do the
 * sorting, status filtering and paging server-side instead of us pulling everything into memory.
 */
export const COLLECTIONS = {
  orders: "storeOrders",
  inquiries: "storeInquiries",
  /**
   * One document per PayMongo webhook event, keyed by the gateway's own event id. Written with
   * `.create()` so a redelivery fails ALREADY_EXISTS and short-circuits — see the webhook route.
   * Grows without bound; prune with a Firestore TTL policy on `expireAt` if it ever matters.
   */
  paymentEvents: "storePaymentEvents",
} as const;

/** A real collection (one doc per record), unlike storeDoc's keyed-map documents. */
export function storeCollection(name: string) {
  return getDb().collection(name);
}

/** Storage bucket for uploaded images. Requires FIREBASE_STORAGE_BUCKET. */
export function getBucket() {
  return getStorage(initAdminApp()).bucket();
}
