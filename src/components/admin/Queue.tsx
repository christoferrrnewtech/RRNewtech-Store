import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for the two work queues (/admin/orders, /admin/inquiries).
 *
 * Both lists behave identically — filter by status, scan newest-first rows, page backwards through
 * time — so the filter bar, empty state, row shell, status pill and pager live here once rather
 * than being written twice with drifting markup.
 */

/**
 * Tone per status, kept dumb: each queue maps its own vocabulary onto these.
 *
 * Built from the brand scale rather than a traffic-light palette — there is no `warning` token, and
 * `accent` is reserved for sale/savings badges (see globals.css). Weight carries the urgency
 * instead: a solid fill for "needs attention", tints for work in progress, grey once it's over.
 * `alert` is the one exception — a failed payment is a problem, not a stage, and reads as one.
 */
export type QueueTone = "new" | "active" | "done" | "dead" | "alert";

const TONES: Record<QueueTone, string> = {
  new: "bg-brand-600 text-white",
  active: "bg-brand-50 text-brand-700",
  done: "bg-success/10 text-success",
  dead: "bg-elevated text-muted",
  alert: "bg-danger/10 text-danger",
};

export function StatusBadge({ label, tone }: { label: string; tone: QueueTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}

/** Drop empty values, so a link never carries `?status=&payment=paid`. */
function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Status filter chips. Links, not buttons — the filter lives in the URL so a filtered queue can be
 * bookmarked and shared with whoever is working it. Scrolls on mobile, same as the storefront's
 * brand filter.
 *
 * `param` and `preserve` exist because /admin/orders has two independent filters (fulfillment and
 * payment). Each bar writes its own key and carries the other's current value through, so picking
 * a status doesn't silently drop the payment filter.
 */
export function StatusFilter({
  basePath,
  active,
  options,
  param = "status",
  preserve,
  allLabel = "All",
  label,
}: {
  basePath: string;
  active?: string;
  options: { value: string; label: string }[];
  param?: string;
  preserve?: Record<string, string | undefined>;
  allLabel?: string;
  /** Names the row when a page has more than one ("Payment", "Status"). */
  label?: string;
}) {
  const href = (value?: string) =>
    `${basePath}${queryString({ ...preserve, [param]: value })}`;

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {label && (
        <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-light">
          {label}
        </span>
      )}
      <div className="-mx-4 -my-1 flex min-w-0 gap-2 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip href={href(undefined)} active={!active}>
          {allLabel}
        </Chip>
        {options.map((o) => (
          <Chip key={o.value} href={href(o.value)} active={active === o.value}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** The card the filter rows sit in, above a queue. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface px-4 py-3.5 sm:px-5">
      {children}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-[6px] border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-surface text-muted hover:border-brand-300 hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

/** The house dashed-border empty panel. */
export function EmptyQueue({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function QueueList({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {children}
    </ul>
  );
}

export function QueueRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated">
        {children}
        <span
          aria-hidden="true"
          className="hidden shrink-0 text-muted-light transition-colors group-hover:text-brand-700 sm:block"
        >
          ›
        </span>
      </Link>
    </li>
  );
}

/**
 * "Show older" pager.
 *
 * A cursor, not a page number: Firestore pages by `startAfter(createdAt)`, and rows arriving while
 * someone reads would make offset paging skip or repeat records. Only rendered when the page came
 * back full, which is the only signal that more may exist.
 */
export function QueuePager({
  basePath,
  params,
  lastCreatedAt,
  full,
}: {
  basePath: string;
  /** Every active filter, so paging doesn't drop one. Empty values are omitted. */
  params?: Record<string, string | undefined>;
  lastCreatedAt?: number;
  full: boolean;
}) {
  if (!full || !lastCreatedAt) return null;

  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`${basePath}${queryString({ ...params, before: String(lastCreatedAt) })}`}
        className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg hover:bg-elevated"
      >
        Show older
      </Link>
    </div>
  );
}

/** Local date+time. Records are timestamped in epoch ms; staff read them in Manila time. */
export function formatWhen(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
