import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(admin)/admin/actions";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";

/**
 * Authenticated admin shell. The guard here is for navigation only — every server action
 * repeats its own authorization check, because actions are callable without ever rendering this.
 */
export default async function AdminAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const nav: (AdminNavItem & { show: boolean })[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard", show: true },
    { href: "/admin/banner", label: "Home banner", icon: "banner", show: isAdmin },
    { href: "/admin/brands", label: "Brands", icon: "brands", show: true },
    { href: "/admin/users", label: "Marketing team", icon: "users", show: isAdmin },
  ];
  const items: AdminNavItem[] = nav
    .filter((n) => n.show)
    .map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Full-height left rail on desktop; collapses to a full-width top strip on mobile. */}
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-5">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-fg"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
              R
            </span>
            R&amp;R Admin
          </Link>

          <div className="mt-6">
            <AdminNav items={items} />
          </div>

          <div className="mt-auto border-t border-line pt-4">
            <p className="text-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-xs text-muted">
              {user.email} · {isAdmin ? "Admin" : "Marketing"}
            </p>
            <form action={logoutAction} className="mt-3">
              <button
                type="submit"
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/"
              className="mt-2 block text-sm text-muted hover:text-brand-700"
              target="_blank"
            >
              View storefront ↗
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
