import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Guides, buying advice, and resources for dental professionals from R&R Newtech Dental.",
  alternates: { canonical: "/discover" },
};

const TOPICS = [
  {
    title: "Buying guides",
    body: "How to choose composites, curing lights, handpieces, and digital scanners for your clinic.",
  },
  {
    title: "Clinic setup",
    body: "Practical checklists for equipping a new operatory — from infection control to imaging.",
  },
  {
    title: "Product spotlights",
    body: "Deep dives on featured brands and the tools trusted by dental professionals nationwide.",
  },
  {
    title: "Care & maintenance",
    body: "Keep instruments and equipment performing longer with simple upkeep routines.",
  },
];

export default function DiscoverPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white">
        <Container className="py-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">Discover</p>
          <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight sm:text-4xl">
            Resources & guides for the modern dental clinic.
          </h1>
          <p className="mt-4 max-w-xl text-white/75">
            Practical advice on the products and equipment we carry — so you can equip your practice
            with confidence. More articles are on the way.
          </p>
          <LinkButton href="/" variant="inverse" className="mt-8">
            Browse the shop
          </LinkButton>
        </Container>
      </section>

      {/* Topics */}
      <section>
        <Container className="py-16">
          <div className="grid gap-4 sm:grid-cols-2">
            {TOPICS.map((t) => (
              <div key={t.title} className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="text-lg font-bold text-fg">{t.title}</h2>
                <p className="mt-2 text-sm text-muted">{t.body}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-brand-700">
                  Coming soon
                </span>
              </div>
            ))}
          </div>

          <p className="mt-10 text-sm text-muted">
            Have a topic you&apos;d like us to cover? Email{" "}
            <a href={`mailto:${SITE.email}`} className="font-semibold text-brand-700 hover:text-brand-800">
              {SITE.email}
            </a>
            .
          </p>
        </Container>
      </section>
    </>
  );
}
