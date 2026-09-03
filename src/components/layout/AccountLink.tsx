"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionInfo } from "@/app/api/session/route";

/**
 * The header's account control: "Login" for a stranger, the signed-in person's name once they're
 * in. Variants mirror `CartButton`'s, and sit beside it in the header bar:
 *
 *   `pill` — bordered pill with a two-line "Account / <state>" label, the desktop control.
 *   `icon` — bare 40px icon button, the same control on narrow screens.
 *   `row`  — full-width row for the mobile drawer.
 *
 * Asks `GET /api/session` rather than reading a cookie. The storefront layout deliberately cannot
 * call `cookies()` — that would turn ~130 prerendered routes dynamic — and the client-readable
 * `rrnt_signed_in` hint can't answer this on its own: it is absent for a session created before it
 * existed and for every staff login, and nothing repairs it. The endpoint knows for certain, and
 * repairs the hint as a side effect. See src/app/api/session/route.ts.
 *
 * The signed-OUT label is what the server renders and what the first client render produces, so
 * hydration matches by construction; the fetch then upgrades it.
 */
export function AccountLink({
  variant = "pill",
  className,
  onNavigate,
}: {
  variant?: "pill" | "icon" | "row";
  className?: string;
  onNavigate?: () => void;
}) {
  const session = useSessionInfo();

  // Staff land on /admin, so name the destination they'll actually get.
  const state = !session?.signedIn
    ? "Login"
    : session.kind === "staff"
      ? "Admin"
      : session.name || "Profile";

  if (variant === "icon") {
    return (
      <Link
        href="/account"
        onClick={onNavigate}
        aria-label={session?.signedIn ? `Account — ${state}` : "Login or register"}
        className={
          className ??
          "inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg hover:bg-elevated lg:hidden"
        }
      >
        <UserIcon />
      </Link>
    );
  }

  if (variant === "row") {
    return (
      <Link
        href="/account"
        onClick={onNavigate}
        className={
          className ??
          "mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-elevated"
        }
      >
        <UserIcon />
        {session?.signedIn ? state : "Login or Register"}
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      onClick={onNavigate}
      className={
        className ??
        "hidden h-11 items-center gap-2 rounded-full border border-line px-4 text-fg hover:border-brand-600 hover:text-brand-700 lg:flex"
      }
    >
      <UserIcon />
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-muted">Account</span>
        {/* Capped so a long first name can't stretch the header bar. */}
        <span className="max-w-[12ch] truncate text-sm font-bold">{state}</span>
      </span>
    </Link>
  );
}

/** Who is signed in, refreshed on every navigation. Null until the first response lands. */
function useSessionInfo(): SessionInfo | null {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);

  // `pathname` in the deps is load-bearing. The layout survives App Router navigations, so a bare
  // `[]` would fetch once and go stale — the header would still say "Login" after signing in, or
  // keep a name after signing out.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionInfo | null) => {
        // Guard against a slow response landing after a newer navigation replaced it.
        if (!cancelled) setSession(data);
      })
      // A failed probe is not worth surfacing: the visitor keeps the signed-out label and the link
      // still works — /account sorts out where they actually belong.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return session;
}

/** Moved here from SiteHeader — this is now its only caller. */
function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
