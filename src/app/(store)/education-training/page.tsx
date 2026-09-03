import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { CampaignCard, SessionsEmpty } from "@/components/education/Sessions";
import { CampaignFilters } from "@/components/education/CampaignFilters";
import { getSessions } from "@/lib/content";
import { SITE } from "@/lib/constants";

/**
 * Rebuild hourly. Admin saves already push a fresh page through `revalidateStorefront()`, but a
 * campaign expires by the calendar rather than by an edit — without this, the last build's cutoff
 * date would keep a finished seminar on the page until someone happened to save something.
 * Still statically rendered; this only bounds how stale the cutoff can get.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Education & Training",
  description:
    "Upcoming seminars, hands-on workshops and product demos from R&R Newtech Dental — dates, venues and registration for dentists and clinic staff across the Philippines.",
  alternates: { canonical: "/education-training" },
};

/** What we run when the calendar is between programmes — context, not a schedule. */
const PROGRAMS = [
  {
    title: "Hands-on workshops",
    body: "Small-group sessions on scanners, curing lights, handpieces and chairside units, run with our brand partners.",
  },
  {
    title: "CE & lecture sessions",
    body: "Evening and online lectures for dentists and clinic staff, often with continuing-education credit.",
  },
  {
    title: "Dental trade shows",
    body: "Catch us at conventions and expos across the Philippines — see the equipment in person and talk pricing.",
  },
  {
    title: "Clinic open houses",
    body: "Visit a partner practice already running the setup you're considering and see how it works day to day.",
  },
];

export default async function EducationTrainingPage() {
  // Upcoming only, soonest first — getSessions drops anything dated before today (Manila).
  const sessions = await getSessions().catch(() => []);

  return (
    <>
      {/* The campaigns. This heading is the page's only <h1> — it moved here when the hero band was
          removed, so the page still has exactly one for search and heading navigation. */}
      <section>
        <Container className="py-10 lg:py-14">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
            Education &amp; Training
          </h1>

          <div className="mt-6">
            {sessions.length > 0 ? (
              // Cards render here on the server; CampaignFilters only decides which are shown.
              <CampaignFilters
                campaigns={sessions.map((s) => ({
                  id: s.id,
                  format: s.format,
                  venue: s.venue ?? "",
                  card: <CampaignCard session={s} />,
                }))}
              />
            ) : (
              <SessionsEmpty />
            )}
          </div>
        </Container>
      </section>

      {/* What we run */}
      <section className="bg-surface">
        <Container className="py-14">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
            What we run
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-line bg-bg p-5">
                <h3 className="text-sm font-bold text-fg">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <Container className="pb-16">
        <div className="flex flex-col items-center gap-5 rounded-2xl bg-ink px-6 py-12 text-center">
          <h2 className="max-w-xl font-[family-name:var(--font-display)] text-2xl font-bold text-white">
            Want a session at your clinic?
          </h2>
          <p className="max-w-lg text-white/70">
            We run private demos and training for practice teams. Tell us what you&apos;d like
            covered and we&apos;ll arrange a date — or email {SITE.email}.
          </p>
          <LinkButton href="/contact" size="lg" variant="inverse">
            Request a session
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
