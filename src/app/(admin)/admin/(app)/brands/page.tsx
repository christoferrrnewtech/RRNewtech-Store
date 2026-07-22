import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAllBrandsForAdmin } from "@/lib/content";
import { StatusPill } from "@/app/(admin)/admin/(app)/page";
import { NewBrandForm } from "./NewBrandForm";

export const metadata: Metadata = { title: "Brands" };

export default async function AdminBrandsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  // A marketing user only ever sees the brands assigned to them.
  const brands = getAllBrandsForAdmin().filter(
    (b) => isAdmin || user.brandSlugs.includes(b.slug),
  );

  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">Brands</h1>
      <p className="mt-2 text-muted">
        {isAdmin
          ? "Add a brand, edit its page, or remove it. New brands start as drafts."
          : "The brands assigned to you. Edits go live once the brand is published."}
      </p>

      {brands.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-surface p-6 text-muted">
          No brands are assigned to your account yet. Ask an admin for access.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {brands.map((b) => (
            <li
              key={b.slug}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <Link href={`/admin/brands/${b.slug}`} className="block hover:bg-elevated">
                <div className="relative aspect-[16/9] border-b border-line bg-white">
                  <Image
                    src={b.logo}
                    alt={b.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-contain p-8"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{b.name}</p>
                    <p className="truncate text-xs text-muted">/brands/{b.slug}</p>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && <NewBrandForm />}
    </div>
  );
}
