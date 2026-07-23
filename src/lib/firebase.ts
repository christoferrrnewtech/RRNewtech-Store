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
 * The store's data lives in prefixed, top-level ("sibling") collections next to the existing
 * `R&RLandingPage` collection. Collection names are centralised in COLLECTIONS below so every
 * caller uses the same string.
 */

import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/** Prefixed sibling collections for the store. `R&RLandingPage` is left untouched. */
export const COLLECTIONS = {
  banners: "storeBanners",
  brands: "storeBrands",
  products: "storeProducts",
  categories: "storeCategories",
  adminUsers: "storeAdminUsers",
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

/** Storage bucket for uploaded images. Requires FIREBASE_STORAGE_BUCKET. */
export function getBucket() {
  return getStorage(initAdminApp()).bucket();
}
