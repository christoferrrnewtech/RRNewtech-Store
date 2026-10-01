import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(admin)/admin/actions";
import { getAllBrandsForAdmin } from "@/lib/content";
import { countNewOrders } from "@/lib/orders";
import { countNewInquiries } from "@/lib/inquiries";
import { AdminNav, type AdminBrandLink, type AdminNavItem } from "@/components/admin/AdminNav";
import { MobileMenu } from "@/components/admin/MobileMenu";

/**
 * Authenticated admin shell. The guard here is for navigation only — every server action
 * repeats its own authorization check, because actions are callable without ever rendering this.
 */
export default async function AdminAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  // Unread counts for the two work queues. Only admins see those sections, so marketing users
  // never pay for the reads. A Firestore hiccup must not take down the whole admin shell.
  const [newOrders, newInquiries] = isAdmin
    ? await Promise.all([countNewOrders().catch(() => 0), countNewInquiries().catch(() => 0)])
    : [0, 0];

  const nav: (AdminNavItem & { show: boolean })[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard", show: true },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: "orders",
      badge: newOrders,
      group: "Sales",
      show: isAdmin,
    },
    {
      href: "/admin/inquiries",
      label: "Inquiries",
      icon: "inquiries",
      badge: newInquiries,
      group: "Sales",
      show: isAdmin,
    },
    { href: "/admin/brands", label: "Brands", icon: "brands", group: "Catalog", show: true },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: "categories",
      group: "Catalog",
      show: isAdmin,
    },
    {
      href: "/admin/banner",
      label: "Home banner",
      icon: "banner",
      group: "Storefront",
      show: isAdmin,
    },
    {
      href: "/admin/shop-by-category",
      label: "Shop by category",
      icon: "shop",
      group: "Storefront",
      show: isAdmin,
    },
    {
      href: "/admin/about",
      label: "About section",
      icon: "about",
      group: "Storefront",
      show: isAdmin,
    },
    {
      href: "/admin/education-training",
      label: "Education & Training",
      icon: "events",
      group: "Storefront",
      show: isAdmin,
    },
    { href: "/admin/users", label: "Marketing team", icon: "users", group: "Team", show: isAdmin },
  ];
  const items: AdminNavItem[] = nav
    .filter((n) => n.show)
    .map(({ href, label, icon, badge, group }) => ({ href, label, icon, badge, group }));

  // Brand quick-nav in the sidebar (marketing users see only their assigned brands).
  const brandLinks: AdminBrandLink[] = (await getAllBrandsForAdmin().catch(() => []))
    .filter((b) => isAdmin || user.brandSlugs.includes(b.slug))
    .map((b) => ({ slug: b.slug, name: b.name, status: b.status }));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Full-height left rail on desktop; collapses to a full-width top strip on mobile. */}
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-4 lg:p-5">
          <MobileMenu
            brand={
              <Link
                href="/admin"
                className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-fg"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
                  R
                </span>
                R&amp;R Admin
              </Link>
            }
          >
          <div className="mt-6">
            <AdminNav items={items} brands={brandLinks} />
          </div>

          <div className="mt-6 border-t border-line pt-4 lg:mt-auto">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
              >
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <span
                className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isAdmin ? "bg-brand-50 text-brand-700" : "bg-elevated text-muted"
                }`}
              >
                {isAdmin ? "Admin" : "Marketing"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/"
                target="_blank"
                className="rounded-lg border border-line px-3 py-1.5 text-center text-xs font-semibold text-fg transition-colors hover:bg-elevated"
              >
                Storefront ↗
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          </MobileMenu>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
