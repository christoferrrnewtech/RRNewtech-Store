import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import type { Banner } from "@/lib/content";
import {
  BODY_SIZE_CLASSES,
  HEADING_SIZE_CLASSES,
  type ButtonColors,
} from "@/lib/banner-style";
import type { CSSProperties } from "react";

/** Hands an admin-picked button palette to the `custom` button variant. */
function buttonVars(c: ButtonColors): CSSProperties {
  return { "--btn-fg": c.text, "--btn-bg": c.background, "--btn-hover": c.hover } as CSSProperties;
}

/**
 * One full-bleed hero slide: photo with the banner's copy laid directly over it.
 *
 * The copy is real text rather than pixels baked into the image — it stays sharp, reflows on a
 * phone, and is indexable. Every field is optional: a banner with only an image renders as a plain
 * photo, which is what the ones saved before the overlay existed do.
 *
 * Colors and sizes come from `banner.style`, which the admin sets per slide.
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
  const { style } = banner;

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
        // No artwork yet — a pale brand-blue field still reads as a designed hero, and keeps the
        // blue copy legible.
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-brand-100" />
      )}

      {hasCopy && (
        <Container className="relative flex min-h-[520px] flex-col justify-center py-20 lg:min-h-[620px]">
          <div className="max-w-2xl">
            {banner.eyebrow && (
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: style.eyebrowColor }}
              >
                {banner.eyebrow}
              </p>
            )}
            {banner.heading && (
              <Heading
                className={`mt-5 font-[family-name:var(--font-display)] font-bold leading-[1.05] ${HEADING_SIZE_CLASSES[style.headingSize]}`}
                style={{ color: style.headingColor }}
              >
                {banner.heading}
              </Heading>
            )}
            {banner.body && (
              <p
                className={`mt-5 max-w-xl ${BODY_SIZE_CLASSES[style.bodySize]}`}
                style={{ color: style.bodyColor }}
              >
                {banner.body}
              </p>
            )}
            {(primaryCta || altCta) && (
              <div className="mt-9 flex flex-wrap gap-3">
                {primaryCta && (
                  <LinkButton
                    href={banner.ctaHref!}
                    variant="custom"
                    size="lg"
                    style={buttonVars(style.cta)}
                  >
                    {banner.ctaLabel}
                  </LinkButton>
                )}
                {altCta && (
                  <LinkButton
                    href={banner.ctaAltHref!}
                    variant="custom"
                    size="lg"
                    style={buttonVars(style.ctaAlt)}
                  >
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

  const frame = "relative min-h-[520px] w-full overflow-hidden bg-brand-50 lg:min-h-[620px]";

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
