import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { AboutIntro } from "@/components/about/AboutIntro";
import { TRUST_POINTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "R&R Newtech Dental Corporation supplies quality dental consumables, instruments, and equipment to clinics and dental professionals across the Philippines.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-surface-2">
        <Container className="py-16">
          <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-fg sm:text-4xl">
            Equipping Philippine dental professionals with supplies they can trust.
          </h1>
        </Container>
      </section>

      {/* The brand story, editable at /admin/about. CTA hidden — its default target is this page. */}
      <AboutIntro showCta={false} />

      <Container className="py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-sm font-bold text-fg">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-5 rounded-2xl bg-ink px-6 py-12 text-center">
          <h2 className="max-w-xl font-[family-name:var(--font-display)] text-2xl font-bold text-white">
            Ready to stock up?
          </h2>
          <p className="max-w-lg text-white/70">
            Browse our catalog or reach out for a bulk quotation tailored to your clinic.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/" size="lg">Shop now</LinkButton>
            <LinkButton href="/contact" size="lg" variant="secondaryDark">Contact sales</LinkButton>
          </div>
        </div>
      </Container>
    </>
  );
}
