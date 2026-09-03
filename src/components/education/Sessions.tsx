import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { sessionDateParts, formatSessionDate } from "@/lib/format";

/**
 * One seminar or training session.
 *
 * Shaped as the eventual Firestore document so wiring the admin editor later is a swap of the
 * page's placeholder array for `await getSessions()`, nothing more. Everything past the first four
 * fields is optional — a session announced before its venue is booked still renders correctly.
 */
export type Session = {
  id: string;
  title: string;
  summary: string;
  /** Short spec/benefit lines shown as bullets, e.g. "Certificate accepted toward state CE". */
  highlights?: string[];
  /** Date-only ISO, e.g. "2026-09-18". Never a timestamp — these are days, not instants. */
  date: string;
  /** Human time range, e.g. "9:00 AM – 12:00 PM". */
  time?: string;
  /** "Makati City" or "Online via Zoom". */
  venue?: string;
  format: "in-person" | "online";
  speaker?: string;
  /** Brand partner running it with us, e.g. "Rundeer". */
  partnerBrand?: string;
  /** Shown as written; "Free" is a valid value. */
  fee?: string;
  seatsLeft?: number;
  capacity?: number;
  /** Registration destination — your form, a Facebook event, or /contact. */
  registerHref?: string;
  /** Optional photo. Absent renders a styled panel rather than a stand-in stock image. */
  image?: string;
  /** Display position, set by dragging in the admin. Absent on campaigns saved before ordering. */
  order?: number;
};

/** Registration always has somewhere to go, so the CTA is never a dead button. */
const registerHref = (s: Session) => s.registerHref || "/contact";

/** Seats read as urgent below this, and take the amber accent globals.css reserves for urgency. */
const LOW_SEATS = 6;

/**
 * "April 2027 · Makati City · 9:00 AM – 12:00 PM · In person" — skips whatever isn't filled in yet.
 *
 * The date leads here rather than sitting on its own line: the tile beside it is `aria-hidden`, so
 * this is the only date a screen reader gets, and a second spelled-out line would just repeat what
 * the tile already shows.
 */
function metaLine(s: Session): string {
  return [
    formatSessionDate(s.date),
    s.venue,
    s.time,
    s.format === "online" ? "Online" : "In person",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Calendar tile anchoring each campaign card. Month and year only — see `format.ts`; the stored
 * day drives sorting and expiry but is never advertised.
 */
export function DateBlock({ date }: { date: string }) {
  const { month, year } = sessionDateParts(date);
  return (
    <div
      aria-hidden
      className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-line bg-surface-2 text-center"
    >
      <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold uppercase leading-none tracking-wide text-brand-600">
        {month}
      </span>
      <span className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold leading-none text-fg">
        {year}
      </span>
    </div>
  );
}

/** Seats remaining, amber once they're running low. Renders nothing when seats aren't tracked. */
function Seats({ session }: { session: Session }) {
  const { seatsLeft, capacity } = session;
  if (seatsLeft === undefined) return null;
  if (seatsLeft <= 0) return <Badge tone="danger">Fully booked</Badge>;
  return (
    <Badge tone={seatsLeft <= LOW_SEATS ? "sale" : "muted"}>
      {seatsLeft} of {capacity ?? seatsLeft} seats left
    </Badge>
  );
}

/**
 * One campaign, full width: details beside a photo panel at `lg`, stacked below it.
 *
 * Every campaign gets this same treatment — there is no featured/list split. The user runs around
 * five at a time, and at that volume promoting one to a card and demoting the rest to one-line rows
 * buys nothing and costs four campaigns their presence.
 */
export function CampaignCard({ session }: { session: Session }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="grid lg:grid-cols-5">
        {/* Details */}
        <div className="p-6 sm:p-7 lg:col-span-3">
          {/* Fee sits with the facts, not with the action — it describes the session, and the CTA
              row reads cleaner as just the button. */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted">{session.format === "online" ? "Online" : "In person"}</Badge>
            <Seats session={session} />
            {session.fee && <Badge tone="brand">{session.fee}</Badge>}
          </div>

          <div className="mt-5 flex gap-5">
            <DateBlock date={session.date} />
            <div className="min-w-0">
              <h3 className="font-[family-name:var(--font-display)] text-xl font-bold leading-snug text-fg sm:text-2xl">
                {session.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted">{metaLine(session)}</p>
            </div>
          </div>

          <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">{session.summary}</p>

          {session.highlights && session.highlights.length > 0 && (
            /* Two columns at sm+ so four bullets take two rows, not four. The dot is a span rather
               than a list marker so it stays level with the first line when text wraps. */
            <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {session.highlights.map((h) => (
                <li key={h} className="flex gap-2.5 text-sm leading-relaxed text-fg">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"
                  />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {(session.speaker || session.partnerBrand) && (
            <p className="mt-4 text-sm text-fg">
              {session.speaker && <span className="font-semibold">{session.speaker}</span>}
              {session.speaker && session.partnerBrand && " · "}
              {session.partnerBrand && <span>with {session.partnerBrand}</span>}
            </p>
          )}

          <div className="mt-6">
            <LinkButton href={registerHref(session)} size="lg">
              Reserve a seat
            </LinkButton>
          </div>
        </div>

        {/* Photo, or a panel when there isn't one yet — better than a stand-in stock image. */}
        <div className="relative min-h-48 bg-gradient-to-br from-brand-700 to-brand-900 lg:col-span-2">
          {session.image ? (
            /* Plain <img>: session photos will be remote admin uploads, same reasoning as AboutIntro. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={session.image}
              alt={session.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3.4"
                  y="5.2"
                  width="17.2"
                  height="15.4"
                  rx="2.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-brand-300"
                />
                <path
                  d="M3.4 10h17.2M8.4 3.4v3.6M15.6 3.4v3.6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="text-brand-300"
                />
              </svg>
              <p className="text-sm font-semibold text-white/90">
                {session.partnerBrand ? `With ${session.partnerBrand}` : "Hands-on training"}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Shown when nothing is scheduled. Not optional polish — once sessions come from Firestore the
 * calendar WILL be empty between programmes, and a bare gap there reads as a broken page.
 */
export function SessionsEmpty() {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <p className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        No sessions scheduled right now.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        We&apos;re finalising the next round of seminars and demos. Tell us what your team wants to
        learn and we&apos;ll let you know as soon as dates are set.
      </p>
      <LinkButton href="/contact" className="mt-6">
        Request a session
      </LinkButton>
    </div>
  );
}
