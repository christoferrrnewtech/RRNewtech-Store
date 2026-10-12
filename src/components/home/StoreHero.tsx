import { getBanners, type Banner } from "@/lib/content";
import { HERO_FALLBACK } from "@/lib/constants";
import { BANNER_STYLE_DEFAULTS } from "@/lib/banner-style";
import { HeroSlide } from "@/components/home/HeroSlide";
import { BannerCarousel } from "@/components/shop/BannerCarousel";

/**
 * The landing page's hero. Slides are managed in the admin at /admin/banner: none → the built-in
 * fallback copy over a brand-blue field; one → a static slide; two or more → an auto-advancing
 * carousel.
 *
 * The fallback matters. Before it, an empty banner doc meant the page opened straight into a
 * content section with no headline at all, which read as broken rather than as a soft launch.
 */
export async function StoreHero() {
  const banners = await getBanners().catch(() => []);

  if (banners.length === 0) {
    const fallback: Banner = {
      id: "fallback",
      image: "",
      alt: "",
      href: "",
      order: 0,
      style: BANNER_STYLE_DEFAULTS,
      ...HERO_FALLBACK,
    };
    return <HeroSlide banner={fallback} priority />;
  }

  if (banners.length === 1) return <HeroSlide banner={banners[0]} priority />;

  return <BannerCarousel banners={banners} />;
}
