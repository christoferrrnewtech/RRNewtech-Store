/**
 * Admin authentication — SERVER ONLY.
 *
 * Credentials are owned by Firebase Authentication (project `rnr-dental-clinics`). Login verifies
 * the email + password against Firebase's Identity Toolkit, then loads the user's role and brand
 * scoping from the `storeAdminUsers/{uid}` document. The existing `admin@rnr.com` / `rnr@123`
 * account is seeded into Firebase Auth, so the same credentials keep working.
 *
 * We keep our own signed session cookie (rather than a Firebase session cookie) so the middleware,
 * layout guards, and every server action's `requireUser`/`requireAdmin`/`canEditBrand` calls are
 * unchanged. Authorization rule: a layout check alone is not authorization — server actions are
 * directly callable HTTP endpoints, so each re-checks.
 *
 * DEPLOY NOTE: set ADMIN_SESSION_SECRET in the environment. A dev-only fallback keeps local runs
 * working; in production the secret is required and login throws without it.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase";
import { getUserByUid, type UserRole } from "@/lib/content";

const SESSION_COOKIE = "rrnt_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Session cookie signing secret. Required in production; dev-only fallback otherwise. */
function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production.");
  }
  return "rrnt-local-dev-secret-do-not-use-in-production";
}

/** The session-safe view of a user. Never carries credentials. */
export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  /** Empty for admins — they have access to everything. */
  brandSlugs: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Session cookie — signed payload, verified on every read.
// ─────────────────────────────────────────────────────────────────────────────

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function serialize(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserialize(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  // Constant-time compare so a bad signature can't be discovered byte by byte.
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return {
      uid: data.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      brandSlugs: Array.isArray(data.brandSlugs) ? data.brandSlugs : [],
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Credential verification against Firebase Authentication.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify email + password with Firebase's Identity Toolkit (the Admin SDK can't check passwords
 * directly). Returns the Firebase uid on success, or null on any failure. Requires
 * FIREBASE_WEB_API_KEY.
 */
async function verifyFirebasePassword(email: string, password: string): Promise<string | null> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY is not set — cannot verify admin logins.");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { localId?: string };
  return data.localId ?? null;
}

/** Validate credentials against Firebase Auth, then load role/brand scope from Firestore. */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;

  const uid = await verifyFirebasePassword(normalized, password);
  if (!uid) return null;

  const profile = await getUserByUid(uid);
  if (!profile) return null; // authenticated but not provisioned as an admin/marketing user

  return {
    uid: profile.uid,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    brandSlugs: profile.brandSlugs,
  };
}

/** Create (or update the password of) a Firebase Auth user; returns the uid. */
export async function createFirebaseUser(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const auth = getAdminAuth();
  try {
    const user = await auth.createUser({ email, password, displayName: name });
    return user.uid;
  } catch (err) {
    // If the account already exists, update its password instead of failing.
    if (err instanceof Error && "code" in err && err.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      await auth.updateUser(existing.uid, { password, displayName: name });
      return existing.uid;
    }
    throw err;
  }
}

export async function deleteFirebaseUser(uid: string): Promise<void> {
  await getAdminAuth().deleteUser(uid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Session lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

export async function createSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, serialize(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return deserialize(store.get(SESSION_COOKIE)?.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards. Call these at the top of every admin page AND every server action.
// ─────────────────────────────────────────────────────────────────────────────

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/admin");
  return user;
}

/** Admins may edit any brand; marketing users only the slugs assigned to them. */
export function canEditBrand(user: SessionUser, slug: string): boolean {
  return user.role === "admin" || user.brandSlugs.includes(slug);
}

export async function requireBrandAccess(slug: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEditBrand(user, slug)) redirect("/admin");
  return user;
}
