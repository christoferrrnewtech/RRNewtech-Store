import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { CLINIC_CTA } from "@/lib/constants";

/**
 * The dark band that closes the landing page. A clinic fitting out or upgrading isn't buying from a
 * product grid one line at a time — it has a list — so this offers the route the catalog can't.
 *
 * The footer below is the same `bg-ink`, so the two would otherwise fuse into one undifferentiated
 * slab of colour — padding alone can't separate them, because empty blue reads as more blue. Hence
 * the closing hairline: the same `white/10` rule the footer already uses above its copyright row,
 * which is what actually makes the boundary visible.
 */
export function ClinicCta() {
  return (
    <section className="border-b border-white/10 bg-ink">
      {/* Asymmetric padding: the top keeps the band's own breathing room, while the bottom is
          opened up to set the CTA off the rule below it. Split from py-14 so only the space
          beneath the content grows. */}
      <Container className="flex flex-col gap-6 pt-14 pb-20 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white lg:text-3xl">
            {CLINIC_CTA.heading}
          </h2>
          <p className="mt-2 max-w-2xl text-white/70">{CLINIC_CTA.body}</p>
        </div>

        <LinkButton
          href={CLINIC_CTA.ctaHref}
          variant="inverse"
          size="lg"
          className="shrink-0 self-start lg:self-auto"
        >
          {CLINIC_CTA.ctaLabel}
        </LinkButton>
      </Container>
    </section>
  );
}
