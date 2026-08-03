import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth";
import { getBrandForAdmin } from "@/lib/content";
import { BrandEditor } from "./BrandEditor";
import { BrandHeader } from "./BrandHeader";
import { SectionTabs } from "./SectionTabs";

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
      <BrandHeader brand={brand} />

      {/* Sticky section tabs — every section one tap away, and the rail tracks where you are. */}
      <SectionTabs slug={brand.slug} />

      <BrandEditor brand={brand} canDelete={user.role === "admin"} />
    </div>
  );
}
