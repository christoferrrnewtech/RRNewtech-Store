import Image from "next/image";
import Link from "next/link";
import { getBanner } from "@/lib/content";

/**
 * Full-bleed picture banner at the top of the Shop All (landing) page.
 * Image-only (no text overlay); spans the full viewport width. The image, alt text and optional
 * link are edited in the admin at /admin/banner — no code edits needed.
 */
export function ShopBanner() {
  const banner = getBanner();

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
