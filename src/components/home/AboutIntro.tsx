import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/constants";
import { getAboutContent } from "@/lib/content";

/**
 * "About" intro band on the landing page, right under the banner: brand story on the left, a large
 * image on the right. Content is editable in the admin (/admin/about) and read from Firestore via
 * `getAboutContent`, which falls back to `ABOUT_DEFAULTS` until it's edited.
 *
 * A plain <img> is used on purpose so both the local SVG placeholder and an uploaded remote WebP
 * render without touching the global next/image config.
 */
const PLACEHOLDER_IMAGE = "/brand/about.svg";

export async function AboutIntro() {
  const about = await getAboutContent();
  const image = about.image || PLACEHOLDER_IMAGE;

  return (
    <section aria-labelledby="about-intro-heading" className="bg-surface">
      <Container className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
        {/* Copy */}
        <div>
          {about.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {about.eyebrow}
            </p>
          )}
          <h2
            id="about-intro-heading"
            className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-fg sm:text-4xl"
          >
            {about.heading}
          </h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted">
            {about.paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {about.ctaLabel && about.ctaHref && (
            <Link
              href={about.ctaHref}
              className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              {about.ctaLabel}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        {/* Image */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-elevated shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={`Inside ${SITE.name}`}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      </Container>
    </section>
  );
}
