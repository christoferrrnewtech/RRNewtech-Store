import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAllBrandsForAdmin, getUsers } from "@/lib/content";
import { PageHeader } from "@/components/admin/Panel";
import { UsersManager } from "./UsersManager";

export const metadata: Metadata = { title: "Marketing team" };

export default async function AdminUsersPage() {
  await requireAdmin();

  // Only marketing teammates belong here — the admin owner is managed elsewhere and must never be
  // deletable from this screen.
  const users = (await getUsers())
    .filter((u) => u.role === "marketing")
    .map((u) => ({ uid: u.uid, name: u.name, email: u.email, brandSlugs: u.brandSlugs }));
  const brands = (await getAllBrandsForAdmin()).map((b) => ({
    slug: b.slug,
    name: b.name,
    logo: b.logo,
  }));

  return (
    <div>
      <PageHeader
        title="Marketing team"
        description="Marketing accounts can edit only the brand pages you assign them. They can’t touch the banner, add or delete brands, or see this page."
      />

      <UsersManager users={users} brands={brands} />
    </div>
  );
}
