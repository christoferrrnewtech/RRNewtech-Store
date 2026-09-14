import { Container } from "@/components/ui/Container";

/**
 * Opening band for /education-training. Carries the page's only <h1>.
 *
 * Type-only rather than photographic: the sessions below each bring their own artwork, and a stock
 * photo here would compete with them for the same attention.
 *
 * Sized to introduce the page, not to fill the screen. The first pass ran to ~540px tall — a
 * `text-6xl` headline inside `py-28` — which pushed the sessions, the actual point of the page,
 * entirely below the fold.
 *
 * The two arbitrary values are measured from the design, not guessed:
 *
 * `text-[2.75rem]` (44px) — Tailwind's scale steps 36 → 48 with nothing between, and 48 reads too
 * large here.
 *
 * `max-w-[38rem]` (608px) — this sets where the headline breaks, which is what makes the band read
 * right far more than its height does. "Learn the equipment before" is ~584px wide at this size and
 * ~674px with " you" added, so the measure has to land between those to break after "before".
 * `max-w-2xl` (672px) is technically inside that window but with 2px to spare, so any font-metric
 * difference would flip the break; 608px sits in the middle with room either side.
 */
export function EducationHero() {
  return (
    <section className="bg-ink">
      <Container className="py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
          Education &amp; Training
        </p>

        <h1 className="mt-4 max-w-[38rem] font-[family-name:var(--font-display)] text-3xl font-bold leading-[1.1] text-white sm:text-4xl lg:text-[2.75rem]">
          Learn the equipment before you buy it
        </h1>

        {/* brand-200, matching the eyebrow above — brand-300 clears the 3:1 bar for a decorative
            rule, but next to a brand-200 eyebrow 30px away it just read as a mismatch. */}
        <div aria-hidden="true" className="mt-6 h-1 w-14 bg-brand-200" />

        {/* Wider measure than the headline, which holds this to two lines rather than three. */}
        <p className="mt-6 max-w-2xl text-base text-white/70">
          We run hands-on workshops, CE lectures and certification trips with our brand partners — so
          your team gets real chairside time with the technology, not just a brochure.
        </p>
      </Container>
    </section>
  );
}
