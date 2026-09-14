import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { CLINIC_CTA } from "@/lib/constants";

/**
 * The dark band that closes the landing page. A clinic fitting out or upgrading isn't buying from a
 * product grid one line at a time — it has a list — so this offers the route the catalog can't.
 *
 * The footer is the same `bg-ink` and sits flush against this, with nothing between them — the two
 * are meant to read as one closing block of colour rather than two stacked bands.
 */
export function ClinicCta() {
  return (
    <section className="bg-ink">
      <Container className="flex flex-col gap-6 py-14 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
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
