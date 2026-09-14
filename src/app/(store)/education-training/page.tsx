import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { CampaignCard, SessionsEmpty } from "@/components/education/Sessions";
import { CampaignFilters } from "@/components/education/CampaignFilters";
import { EducationHero } from "@/components/education/EducationHero";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { getSessions } from "@/lib/content";
import { SITE, type NavIconKey } from "@/lib/constants";

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
const PROGRAMS: { icon: NavIconKey; title: string; body: string }[] = [
  {
    icon: "graduation",
    title: "Hands-on workshops",
    body: "Small-group sessions on scanners, curing lights, handpieces and chairside units, run with our brand partners.",
  },
  {
    icon: "users",
    title: "CE & lecture sessions",
    body: "Evening and online lectures for dentists and clinic staff, often with continuing-education credit.",
  },
  {
    icon: "events",
    title: "Dental trade shows",
    body: "Catch us at conventions and expos across the Philippines — see the equipment in person and talk pricing.",
  },
  {
    icon: "building",
    title: "Clinic open houses",
    body: "Visit a partner practice already running the setup you're considering and see how it works day to day.",
  },
];

export default async function EducationTrainingPage() {
  // Upcoming only, soonest first — getSessions drops anything dated before today (Manila).
  const sessions = await getSessions().catch(() => []);

  return (
    <>
      <EducationHero />

      {/* Upcoming sessions */}
      <section className="bg-bg py-16">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Upcoming sessions
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl">
            Reserve your seat
          </h2>

          <div className="mt-8">
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
      <section className="border-t border-line bg-bg py-16">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            What we run
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold text-fg lg:text-4xl">
            Training formats for every practice
          </h2>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((p) => {
              const Icon = NAV_ICONS[p.icon];
              return (
                <div key={p.title} className="rounded-2xl border border-line bg-surface p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 font-bold text-fg">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Private sessions */}
      <Container className="py-16">
        <div className="rounded-2xl bg-ink p-10 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
            Private sessions
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-2xl font-bold text-white lg:text-3xl">
            Want a session at your clinic?
          </h2>
          <p className="mt-4 max-w-2xl text-white/70">
            We run private demos and training for practice teams. Tell us what you&apos;d like
            covered and we&apos;ll arrange a date — or email{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="font-semibold text-brand-200 underline underline-offset-4 hover:text-white"
            >
              {SITE.email}
            </a>
            .
          </p>
          <LinkButton href="/contact" size="lg" variant="inverse" className="mt-8">
            Request a session
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
