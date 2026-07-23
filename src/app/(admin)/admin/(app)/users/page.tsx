import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAllBrandsForAdmin, getUsers } from "@/lib/content";
import { NewUserForm, UserRow } from "./UserForms";

export const metadata: Metadata = { title: "Marketing team" };

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await getUsers();
  const brands = (await getAllBrandsForAdmin()).map((b) => ({ slug: b.slug, name: b.name }));

  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Marketing team
      </h1>
      <p className="mt-2 text-muted">
        Marketing accounts can edit only the brand pages you assign them. They can&rsquo;t touch the
        banner, add or delete brands, or see this page.
      </p>

      {users.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-surface p-6 text-muted">
          No marketing accounts yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {users.map((u) => (
            <UserRow
              key={u.uid}
              user={{
                uid: u.uid,
                name: u.name,
                email: u.email,
                brandSlugs: u.brandSlugs,
              }}
              brands={brands}
            />
          ))}
        </ul>
      )}

      <NewUserForm brands={brands} />
    </div>
  );
}
