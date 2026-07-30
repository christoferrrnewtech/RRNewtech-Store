import Image from "next/image";
import Link from "next/link";
import { getBanners } from "@/lib/content";
import { BannerCarousel } from "@/components/shop/BannerCarousel";

/**
 * Full-bleed banner at the top of the landing page. Managed in the admin at /admin/banner:
 * no banners → nothing; one → a plain static image; two or more → an auto-advancing carousel.
 */
export async function ShopBanner() {
  const banners = await getBanners();
  if (banners.length === 0) return null;

  if (banners.length === 1) {
    const banner = banners[0];
    const image = (
      <Image
        src={banner.image}
        alt={banner.alt}
        width={1489}
        height={551}
        priority
        sizes="100vw"
        className="h-auto w-full"
      />
    );
    return (
      <section className="w-full">
        {banner.href ? <Link href={banner.href}>{image}</Link> : image}
      </section>
    );
  }

  return <BannerCarousel banners={banners} />;
}
