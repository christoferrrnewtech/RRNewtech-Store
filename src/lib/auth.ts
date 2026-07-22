/**
 * Admin authentication — SERVER ONLY.
 *
 * ⚠️  TEMPORARY, LOCALHOST-ONLY IMPLEMENTATION. Do not deploy this file as-is.
 *
 * The owner account below is hardcoded in source with a plaintext password, and the session
 * secret falls back to a constant when ADMIN_SESSION_SECRET is unset. That is fine while the
 * admin runs on a developer's machine and nothing else.
 *
 * BEFORE ANY DEPLOY:
 *   1. Move authentication to Firebase Auth and delete OWNER_ACCOUNT entirely.
 *   2. Require ADMIN_SESSION_SECRET from the environment — remove the dev fallback.
 *   3. Move users out of data/site-content.json into the real datastore.
 *
 * Authorization rule: `requireUser`/`requireAdmin`/`requireBrandAccess` are called by the admin
 * layout AND independently by every server action. A layout check alone is not authorization —
 * server actions are directly callable HTTP endpoints.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByEmail, type AdminUser, type UserRole } from "@/lib/content";

/** TEMPORARY hardcoded owner account — replace with Firebase Auth. */
const OWNER_ACCOUNT = {
  email: "admin@rnr.com",
  password: "rnr@123",
  name: "R&R Admin",
} as const;

const SESSION_COOKIE = "rrnt_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Dev fallback only — see the warning above. */
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ?? "rrnt-local-dev-secret-do-not-use-in-production";

/** The session-safe view of a user. Never carries the password hash. */
export type SessionUser = {
  email: string;
  name: string;
  role: UserRole;
  /** Empty for admins — they have access to everything. */
  brandSlugs: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Password hashing (marketing users). Node's scrypt — no extra dependency.
// ─────────────────────────────────────────────────────────────────────────────

export function hashPassword(password: string): { passwordHash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, salt };
}

function verifyPassword(password: string, user: AdminUser): boolean {
  const attempt = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");
  // Length check first: timingSafeEqual throws on a length mismatch.
  return attempt.length === stored.length && crypto.timingSafeEqual(attempt, stored);
}

// ─────────────────────────────────────────────────────────────────────────────
// Session cookie — signed payload, verified on every read.
// ─────────────────────────────────────────────────────────────────────────────

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
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
      email: data.email,
      name: data.name,
      role: data.role,
      brandSlugs: Array.isArray(data.brandSlugs) ? data.brandSlugs : [],
    };
  } catch {
    return null;
  }
}

/** Validate credentials against the hardcoded owner, then the stored marketing users. */
export function authenticate(email: string, password: string): SessionUser | null {
  const normalized = email.trim().toLowerCase();

  if (normalized === OWNER_ACCOUNT.email && password === OWNER_ACCOUNT.password) {
    return { email: OWNER_ACCOUNT.email, name: OWNER_ACCOUNT.name, role: "admin", brandSlugs: [] };
  }

  const user = getUserByEmail(normalized);
  if (!user || !verifyPassword(password, user)) return null;

  return { email: user.email, name: user.name, role: user.role, brandSlugs: user.brandSlugs };
}

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
