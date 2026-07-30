import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getBanners } from "@/lib/content";
import { BannerManager } from "./BannerManager";

export const metadata: Metadata = { title: "Home banner" };

export default async function AdminBannerPage() {
  await requireAdmin();
  const banners = await getBanners();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Home banner
      </h1>
      <p className="mt-2 text-muted">
        The banners at the top of the storefront. Add two or more and they rotate as a carousel;
        one shows as a single static image. Changes appear immediately.
      </p>

      <BannerManager banners={banners} />
    </div>
  );
}
