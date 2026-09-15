import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { sessionSlug } from "@/components/education/Sessions";
import { getSessionBySlug, getSessions, todayInManila } from "@/lib/content";
import { formatSessionDate } from "@/lib/format";
import { safeHref, externalLinkProps } from "@/lib/links";
import { SITE } from "@/lib/constants";

/** Matches the listing: an expired session still resolves, so only the cutoff needs refreshing. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const sessions = await getSessions().catch(() => []);
  return sessions.map((s) => ({ slug: sessionSlug(s) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSessionBySlug(slug).catch(() => undefined);
  if (!session) return { title: "Session not found" };

  return {
    title: session.title,
    description: session.summary || session.about,
    alternates: { canonical: `/education-training/${slug}` },
    openGraph: {
      title: session.title,
      description: session.summary || session.about,
      ...(session.image ? { images: [session.image] } : {}),
    },
  };
}

/**
 * One session's own page — the "Learn more" destination for every campaign on /education-training.
 *
 * Every section below the hero is driven by an optional field and disappears when that field is
 * empty, so a session announced with nothing but a title and a date still renders a coherent page
 * rather than a scaffold of empty headings. Everything here is edited from
 * /admin/education-training.
 */
export default async function SessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionBySlug(slug).catch(() => undefined);
  if (!session) notFound();

  const Pin = NAV_ICONS.pin;
  const Users = NAV_ICONS.users;
  const Check = NAV_ICONS.check;

  const past = session.date < todayInManila();
  const registerUrl = safeHref(session.registerHref || "/contact");
  const about = session.about || session.summary;

  return (
    <>
      {/* Hero on ink, the same closing colour the footer and CTA band use. */}
      <section className="bg-ink py-12 lg:py-16">
        <Container>
          <Link
            href="/education-training"
            className="text-xs font-semibold uppercase tracking-wide text-brand-200 hover:text-white"
          >
            ← Education &amp; Training
          </Link>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-brand-200">
            {formatSessionDate(session.date)} · {session.format === "online" ? "Online" : "In person"}
          </p>

          <h1 className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-white lg:text-4xl">
            {session.title}
          </h1>

          {(session.speaker || session.partnerBrand) && (
            <p className="mt-3 text-base font-semibold text-brand-200">
              {session.speaker}
              {session.speaker && session.partnerBrand && " · "}
              {session.partnerBrand && `with ${session.partnerBrand}`}
            </p>
          )}

          {/* A page reached from an old link must say so rather than quietly take a booking. */}
          {past && (
            <p className="mt-5 inline-block rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
              This session has already taken place.
            </p>
          )}

          <div className="mt-6 h-px w-16 bg-brand-300" />

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
            <span>{session.dateNote || formatSessionDate(session.date)}</span>
            {session.venue && (
              <span className="flex items-center gap-1.5">
                <Pin className="h-4 w-4 shrink-0" />
                {session.venue}
              </span>
            )}
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {session.image && (
              /* Plain <img>: session photos are remote admin uploads, as on the cards. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.image}
                alt={session.title}
                className="w-full rounded-2xl border border-line object-cover"
              />
            )}

            {about && (
              <section className={session.image ? "mt-10" : ""}>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
                  About this session
                </h2>
                {/* whitespace-pre-line: the admin writes this in a textarea, and their paragraph
                    breaks are part of what they wrote. */}
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{about}</p>
              </section>
            )}

            {session.audience && (
              <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 font-bold text-fg">
                  <Users className="h-5 w-5 shrink-0 text-brand-600" />
                  Who should attend
                </h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">
                  {session.audience}
                </p>
              </section>
            )}

            {session.highlights && session.highlights.length > 0 && (
              <section className="mt-10">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
                  Highlights
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {session.highlights.map((h) => (
                    <li key={h} className="flex gap-2.5 text-muted">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {session.schedule && session.schedule.length > 0 && (
              <section className="mt-10">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
                  Schedule
                </h2>
                {/* Striped rows rather than a bordered grid: the pairing is what matters, and the
                    zebra carries the eye across a wide row without drawing a box per cell. */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                  {session.schedule.map((row, i) => (
                    <div
                      key={`${row.time}-${row.item}-${i}`}
                      className={`flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:gap-6 ${
                        i % 2 ? "bg-surface-2" : "bg-surface"
                      }`}
                    >
                      <p className="shrink-0 text-sm font-semibold text-brand-700 sm:w-28">
                        {row.time}
                      </p>
                      <p className="text-sm text-fg">{row.item}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {session.included && session.included.length > 0 && (
              <section className="mt-10">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
                  What&apos;s included
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {session.included.map((item) => (
                    <li key={item} className="flex gap-2.5 text-muted">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {session.certificateNote && (
              <p className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm font-medium leading-relaxed text-fg">
                {session.certificateNote}
              </p>
            )}
          </div>

          {/* Registration rail. `lg:sticky` keeps the CTA reachable down a long programme. */}
          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-line bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                Registration
              </p>
              <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold text-fg">
                {session.fee || "Contact us for pricing"}
              </h2>
              {session.feeNote && (
                <p className="mt-2 text-sm leading-relaxed text-muted">{session.feeNote}</p>
              )}

              {session.seatsLeft !== undefined && (
                <div className="mt-3">
                  <Badge tone={session.seatsLeft <= 0 ? "danger" : "muted"}>
                    {session.seatsLeft <= 0
                      ? "Fully booked"
                      : `${session.seatsLeft} of ${session.capacity ?? session.seatsLeft} seats left`}
                  </Badge>
                </div>
              )}

              <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
                <Row label="Date">{session.dateNote || formatSessionDate(session.date)}</Row>
                {session.time && <Row label="Time">{session.time}</Row>}
                {session.venue && <Row label="Venue">{session.venue}</Row>}
                {session.formatNote && <Row label="Format">{session.formatNote}</Row>}
              </dl>

              <div className="mt-6 space-y-3">
                <LinkButton
                  href={registerUrl}
                  size="lg"
                  className="w-full"
                  {...externalLinkProps(registerUrl)}
                >
                  {session.registerLabel || "Reserve a seat"}
                </LinkButton>
                <LinkButton
                  href={`mailto:${SITE.email}?subject=${encodeURIComponent(session.title)}`}
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Email us
                </LinkButton>
              </div>
            </section>

            {session.payment && session.payment.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-bold text-fg">Payment</h2>
                <ul className="mt-3 space-y-2.5 text-sm">
                  {session.payment.map((line) => (
                    <li key={line} className="flex gap-2.5 text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </Container>
    </>
  );
}

/** One label/value pair in the registration card. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-light">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-fg">{children}</dd>
    </div>
  );
}
