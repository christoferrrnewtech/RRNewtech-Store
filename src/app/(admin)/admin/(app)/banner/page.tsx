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
      <BannerManager banners={banners} />
    </div>
  );
}
