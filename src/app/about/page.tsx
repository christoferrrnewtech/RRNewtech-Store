import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { TRUST_POINTS, SITE } from "@/lib/constants";

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
          <p className="mt-5 max-w-2xl text-lg text-muted">{SITE.description}</p>
        </Container>
      </section>

      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-base leading-relaxed text-muted">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
              Who we are
            </h2>
            <p>
              {SITE.legalName} is a Philippine dental supply company built to make sourcing quality
              products simple, fast, and affordable — whether you run a busy multi-chair clinic or a
              solo practice.
            </p>
            <p>
              We partner with trusted manufacturers and authorized distributors so every item we
              carry meets the standards your patients deserve. From everyday consumables to clinic
              equipment, we keep your operatory stocked and running.
            </p>
            <p>
              Our goal is straightforward: honest pricing, dependable stock, and delivery you can
              count on anywhere in the Philippines.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {TRUST_POINTS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="text-sm font-bold text-fg">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.body}</p>
              </div>
            ))}
          </div>
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
