import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAllBrandsForAdmin, getUsers } from "@/lib/content";

export default async function AdminDashboard() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const brands = (await getAllBrandsForAdmin()).filter(
    (b) => isAdmin || user.brandSlugs.includes(b.slug),
  );
  const published = brands.filter((b) => b.status === "published").length;
  const userCount = isAdmin ? (await getUsers()).length : 0;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Welcome back, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-muted">
        {isAdmin
          ? "Edit the storefront banner, manage brands, and give your marketing team access to the brands they own."
          : "Edit the brand pages assigned to you. Changes go live as soon as the brand is published."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          href="/admin/brands"
          title="Brands"
          value={`${brands.length}`}
          detail={`${published} published · ${brands.length - published} draft`}
        />
        {isAdmin && (
          <>
            <Card href="/admin/banner" title="Home banner" value="Edit" detail="Image, alt text and link" />
            <Card
              href="/admin/users"
              title="Marketing team"
              value={`${userCount}`}
              detail="Accounts with brand access"
            />
          </>
        )}
      </div>

      {brands.length > 0 && (
        <section className="mt-12">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            {isAdmin ? "All brands" : "Your brands"}
          </h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {brands.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/admin/brands/${b.slug}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-elevated"
                >
                  <span className="font-semibold text-fg">{b.name}</span>
                  <StatusPill status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({
  href,
  title,
  value,
  detail,
}: {
  href: string;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{title}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </Link>
  );
}

export function StatusPill({ status }: { status: "draft" | "published" }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        published ? "bg-success/10 text-success" : "bg-elevated text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-success" : "bg-muted-light"}`} />
      {published ? "Published" : "Draft"}
    </span>
  );
}
