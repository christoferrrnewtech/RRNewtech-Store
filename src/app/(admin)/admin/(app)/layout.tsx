import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(admin)/admin/actions";

/**
 * Authenticated admin shell. The guard here is for navigation only — every server action
 * repeats its own authorization check, because actions are callable without ever rendering this.
 */
export default async function AdminAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const nav = [
    { href: "/admin", label: "Dashboard", show: true },
    { href: "/admin/banner", label: "Home banner", show: isAdmin },
    { href: "/admin/brands", label: "Brands", show: true },
    { href: "/admin/users", label: "Marketing team", show: isAdmin },
  ].filter((item) => item.show);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8">
      <aside className="shrink-0 lg:w-56">
        <Link href="/admin" className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          R&amp;R Admin
        </Link>

        <nav className="mt-6 flex flex-wrap gap-1 lg:flex-col" aria-label="Admin">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-elevated hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-line pt-4">
          <p className="text-sm font-semibold text-fg">{user.name}</p>
          <p className="text-xs text-muted">
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
            className="mt-3 block text-sm text-muted hover:text-brand-700"
            target="_blank"
          >
            View storefront ↗
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
