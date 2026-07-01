import Image from "next/image";

/**
 * Full-bleed picture banner at the top of the Shop All (landing) page.
 * Image-only (no text overlay); spans the full viewport width. Swap public/brand/banner1.png
 * to change the artwork — no code edits needed.
 */
export function ShopBanner() {
  return (
    <section className="w-full">
      <Image
        src="/brand/banner1.png"
        alt="R&R Newtech Dental — dental supplies delivered nationwide"
        width={1489}
        height={551}
        priority
        sizes="100vw"
        className="h-auto w-full"
      />
    </section>
  );
}
