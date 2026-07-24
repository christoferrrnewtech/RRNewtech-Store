import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth";
import { getBrandForAdmin } from "@/lib/content";
import { StatusPill } from "@/app/(admin)/admin/(app)/page";
import { BrandEditor } from "./BrandEditor";
import { BRAND_EDITOR_SECTIONS } from "./sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getBrandForAdmin(slug))?.name ?? "Brand" };
}

export default async function AdminBrandEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Redirects to /admin if this user doesn't own the brand. The actions check again themselves.
  const user = await requireBrandAccess(slug);

  const brand = await getBrandForAdmin(slug);
  if (!brand) notFound();

  return (
    <div>
      {/* Back to the list on mobile (on desktop the rail is always visible). */}
      <Link
        href="/admin/brands"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-brand-700 lg:hidden"
      >
        ← All brands
      </Link>

      {/* Compact editor header: which brand, its status, and a jump to the live page. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
            <Image src={brand.logo} alt="" fill sizes="44px" className="object-contain p-1.5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-bold text-fg">
              {brand.name}
            </h2>
            <p className="truncate text-xs text-muted">/brands/{brand.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={brand.status} />
          <Link
            href={`/brands/${brand.slug}`}
            target="_blank"
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View live ↗
          </Link>
        </div>
      </div>

      {/* Sticky section-jump chips — every section one tap away, without eating a column. */}
      <nav className="sticky top-0 z-10 -mx-1 mt-4 flex gap-1.5 overflow-x-auto border-b border-line bg-bg/90 px-1 py-2 backdrop-blur">
        {BRAND_EDITOR_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <BrandEditor brand={brand} canDelete={user.role === "admin"} />
    </div>
  );
}
