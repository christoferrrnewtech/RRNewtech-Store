import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import type { Banner } from "@/lib/content";
import {
  BODY_SIZE_PX,
  HEADING_SIZE_PX,
  bannerLines,
  scaled,
  type ButtonColors,
} from "@/lib/banner-style";
import { Fragment, type CSSProperties } from "react";

/** Copy with each `<br>` (or newline) rendered as a real line break. */
function Lines({ text }: { text: string }) {
  return bannerLines(text).map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/**
 * An admin-picked button palette for the `custom` button variant, plus padding, text and corners
 * that scale with the slide (overriding the fixed `lg` size).
 */
function buttonStyle(c: ButtonColors): CSSProperties {
  return {
    "--btn-fg": c.text,
    "--btn-bg": c.background,
    "--btn-hover": c.hover,
    fontSize: scaled(16, 10),
    padding: `${scaled(14, 5)} ${scaled(28, 10)}`,
    borderRadius: scaled(8, 4),
  } as CSSProperties;
}

/**
 * One full-bleed hero slide: photo with the banner's copy laid directly over it.
 *
 * The copy is real text rather than pixels baked into the image — it stays sharp and is
 * indexable. Every field is optional: a banner with only an image renders as a plain photo, which
 * is what the ones saved before the overlay existed do.
 *
 * Colors and sizes come from `banner.style`, which the admin sets per slide.
 *
 * The slide is locked to 2.7:1 (1489×551, the shape admins are told to upload), so the banner is
 * shown whole and only scales — it used to fill a fixed 520/620px height and lost its sides or
 * top/bottom depending on the screen. The copy scales with it (see `scaled`), down to a readable
 * floor on phones. If a long overlay still outgrows the 2.7:1 box, the frame grows to fit it and
 * the image covers the taller frame rather than the text being clipped.
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
  const headingPx = HEADING_SIZE_PX[style.headingSize];
  const bodyPx = BODY_SIZE_PX[style.bodySize];

  const content = (
    <>
      {/* Sets the 2.7:1 height. Not positioned, so the image's `fill` covers the whole frame —
          identical to this box unless overlay copy has made the frame taller. */}
      <div className="col-start-1 row-start-1 aspect-[1489/551] w-full" />
      {banner.image ? (
        <Image
          src={banner.image}
          alt={banner.alt}
          fill
          priority={priority}
          quality={85}
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        // No artwork yet — a pale brand-blue field still reads as a designed hero, and keeps the
        // blue copy legible.
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-brand-100" />
      )}

      {hasCopy && (
        // Vertical padding is scaled(48, 14), spelled out because Container only takes a className.
        <Container className="relative col-start-1 row-start-1 flex flex-col justify-center py-[clamp(14px,3.333cqw,48px)]">
          {/* 672px at the reference width; on a phone it may take up to 75% of the slide, so the
              floored text sizes don't wrap into a tall column. */}
          <div className="max-w-[min(42rem,max(46.667cqw,75%))]">
            {banner.eyebrow && (
              <p
                className="font-semibold uppercase tracking-[0.18em]"
                style={{ color: style.eyebrowColor, fontSize: scaled(12, 8) }}
              >
                {banner.eyebrow}
              </p>
            )}
            {banner.heading && (
              <Heading
                className="font-[family-name:var(--font-display)] font-bold leading-[1.05]"
                style={{
                  color: style.headingColor,
                  fontSize: scaled(headingPx, Math.round(headingPx / 4)),
                  marginTop: scaled(20, 4),
                }}
              >
                <Lines text={banner.heading} />
              </Heading>
            )}
            {banner.body && (
              <p
                className="max-w-[36rem]"
                style={{
                  color: style.bodyColor,
                  fontSize: scaled(bodyPx, 10),
                  marginTop: scaled(20, 4),
                }}
              >
                <Lines text={banner.body} />
              </p>
            )}
            {(primaryCta || altCta) && (
              <div
                className="flex flex-wrap"
                style={{ gap: scaled(12, 6), marginTop: scaled(36, 8) }}
              >
                {primaryCta && (
                  <LinkButton
                    href={banner.ctaHref!}
                    variant="custom"
                    size="lg"
                    style={buttonStyle(style.cta)}
                  >
                    {banner.ctaLabel}
                  </LinkButton>
                )}
                {altCta && (
                  <LinkButton
                    href={banner.ctaAltHref!}
                    variant="custom"
                    size="lg"
                    style={buttonStyle(style.ctaAlt)}
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

  // `@container` makes the frame the `cqw` reference for the scaled copy.
  const frame = "@container relative grid w-full overflow-hidden bg-brand-50";

  // A slide with its own CTAs is already clickable in the places that matter; wrapping it in a
  // second link would nest interactive elements. So `href` only makes the *whole* slide a link on
  // plain image banners.
  if (banner.href && !primaryCta && !altCta) {
    return (
      <Link href={banner.href} className={frame}>
        {content}
      </Link>
    );
  }

  return <div className={frame}>{content}</div>;
}
