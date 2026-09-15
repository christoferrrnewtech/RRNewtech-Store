import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { SessionDetails } from "@/components/education/SessionDetails";
import { sessionDateParts } from "@/lib/format";
import { safeHref, externalLinkProps, isExternalHref } from "@/lib/links";

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
  /**
   * An external event page — a brochure, Facebook event or brand microsite.
   *
   * No longer what "Learn more" opens: every session now has its own page on the site, and this is
   * surfaced there as a secondary link. Kept because sessions already carry one.
   */
  detailsHref?: string;

  /* ---- Detail page. All optional: a session announced before its programme is settled still
     renders a correct page, just a shorter one. Each section is hidden when its field is empty. */

  /** Long-form description under "About this session". Falls back to `summary` when unset. */
  about?: string;
  /** "Who should attend" — one paragraph, not a list. */
  audience?: string;
  /** Running order. Time is shown as written ("8:00 AM"), so half-days and multi-days both work. */
  schedule?: { time: string; item: string }[];
  /** "What's included" — what a seat actually buys. */
  included?: string[];
  /** Certificate line, called out under what's included. */
  certificateNote?: string;
  /** Sits under the registration heading, e.g. early-bird terms. */
  feeNote?: string;
  /** Overrides the formatted date in the registration card, for "April 2027 (day to be announced)". */
  dateNote?: string;
  /** Prose form of the format, e.g. "Lecture in the morning, hands-on in the afternoon". */
  formatNote?: string;
  /** Payment terms, one per line. */
  payment?: string[];
  /** Optional photo. Absent renders a styled panel rather than a stand-in stock image. */
  image?: string;
  /** Display position, set by dragging in the admin. Absent on campaigns saved before ordering. */
  order?: number;
};

/** Registration always has somewhere to go, so the CTA is never a dead button. */
const registerHref = (s: Session) => safeHref(s.registerHref || "/contact");

/**
 * URL slug for a session, from its title, falling back to its id when the title is empty or is
 * all punctuation. Derived rather than stored so a retitled session's URL follows it — these are
 * announcements with a short life, not permalinks anyone has bookmarked for years.
 */
export function sessionSlug(s: Pick<Session, "id" | "title">): string {
  const fromTitle = s.title
    // Fold accents to their base letter first, so "DURR DENTAL" stays readable instead of
    // collapsing to "d-rr" once the bare strip removes the U.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return fromTitle || s.id;
}

/** Canonical detail-page URL. Single source of truth for the shape, as `brandProductHref` is. */
export function sessionHref(s: Pick<Session, "id" | "title">): string {
  return `/education-training/${sessionSlug(s)}`;
}

/** Seats read as urgent below this, and take the amber accent globals.css reserves for urgency. */
const LOW_SEATS = 6;

/**
 * "Makati City · In person", or just the format when no venue is set yet.
 *
 * Deliberately no date: the badge on the photo carries it, and repeating it here would say the same
 * thing twice on one card.
 */
function placeLine(s: Session): string {
  return [s.venue, s.format === "online" ? "Online" : "In person"].filter(Boolean).join(" · ");
}

/**
 * Tells a screen-reader user that a link leaves the site, which a sighted user learns from the new
 * tab itself. Renders nothing for an internal link.
 */
function NewTabNote({ href }: { href: string }) {
  if (!isExternalHref(href)) return null;
  return <span className="sr-only">(opens in a new tab)</span>;
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
 * One campaign as a vertical card: photo with a date badge, then the details, then the actions.
 *
 * Every campaign gets the same treatment — there is no featured/list split. The user runs around
 * five at a time, and at that volume promoting one and demoting the rest to one-line rows buys
 * nothing and costs four campaigns their presence.
 *
 * `h-full` plus the spacer above the buttons is what keeps a row of cards aligned: summaries differ
 * wildly in length, and without it each card's CTA would sit at its own height.
 */
export function CampaignCard({ session }: { session: Session }) {
  const { month, year } = sessionDateParts(session.date);
  const Pin = NAV_ICONS.pin;
  // Always the session's own page now, so every card has a "Learn more" rather than only those
  // given an external link. `detailsHref` still exists and is surfaced on that page.
  const detailsUrl = sessionHref(session);
  const registerUrl = registerHref(session);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Photo, or a branded panel when there isn't one yet — better than a stand-in stock image. */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-brand-700 to-brand-900">
        {session.image ? (
          /* Plain <img>: session photos are remote admin uploads, same reasoning as AboutIntro. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={session.image}
            alt={session.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold text-white/90">
              {session.partnerBrand ? `With ${session.partnerBrand}` : "Hands-on training"}
            </p>
          </div>
        )}

        {/* Month and year only — the stored day drives sorting and expiry but is never advertised. */}
        <p className="absolute left-3 top-3 bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          <span className="sr-only">Runs in </span>
          {month} {year}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Pin className="h-4 w-4 shrink-0" />
          {placeLine(session)}
        </p>

        <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-lg font-bold leading-snug text-fg">
          {session.title}
        </h3>

        {(session.speaker || session.partnerBrand) && (
          <p className="mt-1.5 text-sm font-semibold text-brand-700">
            {session.speaker}
            {session.speaker && session.partnerBrand && " · "}
            {session.partnerBrand && `with ${session.partnerBrand}`}
          </p>
        )}

        <SessionDetails summary={session.summary} highlights={session.highlights} />

        {/* Fee and seats describe the session, so they sit with the facts, not with the actions. */}
        {(session.fee || session.seatsLeft !== undefined) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Seats session={session} />
            {session.fee && <Badge tone="brand">{session.fee}</Badge>}
          </div>
        )}

        {/* Pushes the buttons to the bottom so every card in a row ends on the same line. */}
        <div className="flex-1" />

        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href={detailsUrl} className="flex-1 whitespace-nowrap">
            Learn more
          </LinkButton>
          <LinkButton
            href={registerUrl}
            variant="secondary"
            className="flex-1 whitespace-nowrap"
            {...externalLinkProps(registerUrl)}
          >
            Reserve a seat
            <NewTabNote href={registerUrl} />
          </LinkButton>
        </div>
      </div>
    </article>
  );
}

/**
 * Shown when nothing is scheduled. Not optional polish — the calendar WILL be empty between
 * programmes, and a bare gap there reads as a broken page. Rendered in place of the whole grid, so
 * it spans the full width rather than sitting in one narrow column.
 */
export function SessionsEmpty() {
  return (
    <div className="w-full rounded-2xl border border-line bg-surface px-6 py-14 text-center">
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
