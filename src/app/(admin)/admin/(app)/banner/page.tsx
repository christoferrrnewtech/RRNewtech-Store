import type { Metadata } from "next";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { getBanner } from "@/lib/content";
import { BannerForm } from "./BannerForm";

export const metadata: Metadata = { title: "Home banner" };

export default async function AdminBannerPage() {
  await requireAdmin();
  const banner = getBanner();

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Home banner
      </h1>
      <p className="mt-2 text-muted">
        The full-width image at the top of the storefront. Changes appear immediately.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <Image
          src={banner.image}
          alt={banner.alt}
          width={1489}
          height={551}
          className="h-auto w-full"
        />
      </div>

      <BannerForm banner={banner} />
    </div>
  );
}
