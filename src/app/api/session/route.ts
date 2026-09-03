import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSessionCustomer } from "@/lib/customer-auth";
import { CUSTOMER_HINT_COOKIE } from "@/lib/customer-hint";

/**
 * Who is signed in, for the browser — the AUTHORITATIVE answer.
 *
 * The storefront header can't read the session itself: it lives in the layout, which wraps ~130
 * prerendered routes, and one `cookies()` call there would turn every product and brand page into
 * an origin hit with a Firestore round trip for the menus (see pay-window.ts). A route handler is
 * always dynamic anyway, so reading cookies HERE costs nothing that was static before.
 *
 * This replaces guessing from the `rrnt_signed_in` hint cookie. A hint written only at login is
 * wrong for anyone whose session predates it, for every staff member (whose login never wrote one),
 * and for anyone who cleared cookies selectively — and it can never repair itself, because the
 * thing that writes it only runs when you log in.
 *
 * So this endpoint also REPAIRS the hint on every call: it re-asserts it for a signed-in customer
 * and clears it otherwise, which is what keeps the cart's synchronous `hasCustomerSessionHint()`
 * check honest without making Add-to-cart wait on a network round trip.
 *
 * Returns identity, never authorization. Nothing may be gated on this response — a client can send
 * whatever it likes to whatever it likes. The signed cookies remain the only source of truth, and
 * every page and action re-reads them.
 */

export const dynamic = "force-dynamic";

export type SessionInfo = {
  signedIn: boolean;
  /** "customer" shops; "staff" belongs in /admin. Null when signed out. */
  kind: "customer" | "staff" | null;
  /** First name for a customer, display name for staff. "" when signed out. */
  name: string;
};

export async function GET() {
  // Customer first, matching loginCustomerAction: someone holding both sessions came in through
  // the storefront door, so that is the identity the storefront shows.
  const customer = await getSessionCustomer();
  const staff = customer ? null : await getSessionUser();

  const info: SessionInfo = customer
    ? { signedIn: true, kind: "customer", name: customer.firstName }
    : staff
      ? { signedIn: true, kind: "staff", name: staff.name }
      : { signedIn: false, kind: null, name: "" };

  const res = NextResponse.json(info, {
    // Per-visitor and security-adjacent: must never land in a shared or bfcache-style cache.
    headers: { "Cache-Control": "no-store, private" },
  });

  // Repair the client-readable hint so the cart gate agrees with the real session.
  if (info.kind === "customer") {
    res.cookies.set(CUSTOMER_HINT_COOKIE, "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    res.cookies.delete(CUSTOMER_HINT_COOKIE);
  }

  return res;
}
