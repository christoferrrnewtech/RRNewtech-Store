import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import type { Banner } from "@/lib/content";

/**
 * One full-bleed hero slide: photo, dark scrim, and the banner's copy laid over it.
 *
 * The copy is real text rather than pixels baked into the image — it stays sharp, reflows on a
 * phone, and is indexable. Every field is optional: a banner with only an image renders as a plain
 * photo, which is what the ones saved before the overlay existed do.
 *
 * Shared by the single-banner and carousel paths so the two can't drift apart.
 */
export function HeroSlide({
  banner,
  priority = false,
  headingLevel = "h1",
}: {
  banner: Banner;
  /** True for the first slide — it's the LCP element. */
  priority?: boolean;
  /** Slides after the first aren't the page's h1. */
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const hasCopy = Boolean(banner.eyebrow || banner.heading || banner.body);
  const primaryCta = banner.ctaLabel && banner.ctaHref;
  const altCta = banner.ctaAltLabel && banner.ctaAltHref;

  const content = (
    <>
      {banner.image ? (
        <Image
          src={banner.image}
          alt={banner.alt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        // No artwork yet — a brand-blue field still reads as a designed hero.
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900" />
      )}

      {/* Scrim. Weighted to the left, where the copy sits, so white text keeps its contrast over
          whatever photo an admin uploads while the right side of the image stays visible. */}
      {hasCopy && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-900/75 to-brand-900/25"
        />
      )}

      {hasCopy && (
        <Container className="relative flex min-h-[520px] flex-col justify-center py-20 lg:min-h-[620px]">
          <div className="max-w-2xl">
            {banner.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                {banner.eyebrow}
              </p>
            )}
            {banner.heading && (
              <Heading className="mt-5 font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                {banner.heading}
              </Heading>
            )}
            {banner.body && (
              <p className="mt-5 max-w-xl text-base text-white/75 lg:text-lg">{banner.body}</p>
            )}
            {(primaryCta || altCta) && (
              <div className="mt-9 flex flex-wrap gap-3">
                {primaryCta && (
                  <LinkButton href={banner.ctaHref!} variant="inverse" size="lg">
                    {banner.ctaLabel}
                  </LinkButton>
                )}
                {altCta && (
                  <LinkButton href={banner.ctaAltHref!} variant="secondaryDark" size="lg">
                    {banner.ctaAltLabel}
                  </LinkButton>
                )}
              </div>
            )}
          </div>
        </Container>
      )}
    </>
  );

  const frame = "relative min-h-[520px] w-full overflow-hidden bg-brand-900 lg:min-h-[620px]";

  // A slide with its own CTAs is already clickable in the places that matter; wrapping it in a
  // second link would nest interactive elements. So `href` only makes the *whole* slide a link on
  // plain image banners.
  if (banner.href && !primaryCta && !altCta) {
    return (
      <Link href={banner.href} className={`block ${frame}`}>
        {content}
      </Link>
    );
  }

  return <div className={frame}>{content}</div>;
}
