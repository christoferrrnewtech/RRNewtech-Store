"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveSessionAction,
  deleteSessionAction,
  reorderSessionsAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import Link from "next/link";
import {
  Field,
  ImageInput,
  RepeatableText,
  SaveBar,
  SubmitButton,
  TextInput,
  TextArea,
  Select,
} from "@/components/admin/Form";
import { FormSection, PageHeader, Panel } from "@/components/admin/Panel";
import { sessionHref, type Session } from "@/components/education/Sessions";
import type { LinkOption } from "@/lib/content";

const ADD = "add" as const;
type Selection = string | typeof ADD;

/**
 * A link input backed by the site's own pages.
 *
 * A native <datalist> rather than a custom combobox: the browser already filters the list as you
 * type, keeps keyboard and screen-reader behaviour, and — crucially — leaves the field free text,
 * so an external brochure or Facebook event URL is still just as typeable as an internal path.
 *
 * The ids are suffixed per field because two inputs on one form can't share a list element and
 * still be described independently.
 */
function LinkField({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: LinkOption[];
  placeholder?: string;
}) {
  const listId = `links-${name}`;
  return (
    <>
      <TextInput
        name={name}
        defaultValue={defaultValue}
        list={listId}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

/**
 * Paired time/entry rows for a session's programme.
 *
 * Two parallel input names rather than one encoded string ("8:00 AM|Registration"): the action
 * zips `scheduleTime` and `scheduleItem` by index, so nothing has to be parsed back out and a
 * stray separator in an entry can't split a row.
 */
function ScheduleEditor({ initial }: { initial: { time: string; item: string }[] }) {
  const [rows, setRows] = useState<{ time: string; item: string }[]>(
    initial.length ? initial : [{ time: "", item: "" }],
  );

  const update = (i: number, patch: Partial<{ time: string; item: string }>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {/* Widths on wrappers: TextInput's own `w-full` would win over a width passed to it. */}
          <div className="w-28 shrink-0 sm:w-32">
            <TextInput
              name="scheduleTime"
              value={row.time}
              onChange={(e) => update(i, { time: e.target.value })}
              placeholder="8:00 AM"
              aria-label={`Row ${i + 1} time`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <TextInput
              name="scheduleItem"
              value={row.item}
              onChange={(e) => update(i, { item: e.target.value })}
              placeholder="Registration and coffee"
              aria-label={`Row ${i + 1} entry`}
            />
          </div>
          <button
            type="button"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            className="shrink-0 rounded-lg border border-line px-3 text-sm text-muted hover:bg-elevated hover:text-danger"
            aria-label={`Remove row ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { time: "", item: "" }])}
        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        + Add row
      </button>
    </div>
  );
}

/** Today in Manila, for flagging past campaigns in the list. Matches `getSessions`' cutoff. */
function todayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function SessionsManager({
  sessions,
  linkOptions,
}: {
  sessions: Session[];
  linkOptions: LinkOption[];
}) {
  const [selected, setSelected] = useState<Selection>(sessions[0]?.id ?? ADD);
  // Local order for instant drag/arrow feedback; reconciled to the server's list below.
  const [items, setItems] = useState<Session[]>(sessions);
  const [, startTransition] = useTransition();

  // Adjust state during render when the server sends a new list (after save/delete/reorder) —
  // React's recommended pattern for syncing to a changed prop, avoiding a setState effect.
  const [prev, setPrev] = useState(sessions);
  if (sessions !== prev) {
    setPrev(sessions);
    setItems(sessions);
    if (sessions.length > prev.length) {
      // Newly added — jump to it so the editor can keep working on it.
      const added = sessions.find((s) => !prev.some((p) => p.id === s.id));
      if (added) setSelected(added.id);
    } else if (selected !== ADD && !sessions.some((s) => s.id === selected)) {
      // The selected campaign was deleted → fall back sensibly.
      setSelected(sessions[0]?.id ?? ADD);
    }
  }

  function commitOrder(next: Session[]) {
    setItems(next); // optimistic
    startTransition(() => reorderSessionsAction(next.map((s) => s.id)));
  }

  function move(id: string, dir: -1 | 1) {
    const i = items.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  }

  function drop(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const from = items.findIndex((s) => s.id === dragId);
    const to = items.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOrder(next);
  }

  const today = todayInManila();
  const current = items.find((s) => s.id === selected);

  const upcoming = items.filter((s) => s.date >= today).length;

  return (
    <div>
      <PageHeader
        title="Education & Training"
        description={`${upcoming} upcoming · ${items.length - upcoming} past. Past campaigns stay here for reference but drop off the storefront automatically.`}
        actions={
          <>
            <Link
              href="/education-training"
              target="_blank"
              className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
            >
              View page ↗
            </Link>
            <button
              type="button"
              onClick={() => setSelected(ADD)}
              disabled={selected === ADD}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add campaign
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left — campaign list */}
        <div className="self-start rounded-2xl border border-line bg-surface lg:sticky lg:top-6">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-fg">Campaigns</h2>
            <p className="text-xs text-muted">Drag, or use the arrows, to set the storefront order.</p>
          </div>
          {items.length > 0 ? (
            <ul className="space-y-1 p-2">
              {items.map((s, i) => (
                <CampaignRow
                  key={s.id}
                  session={s}
                  index={i}
                  total={items.length}
                  past={s.date < today}
                  active={selected === s.id}
                  onSelect={() => setSelected(s.id)}
                  onMove={move}
                  onDrop={drop}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted">No campaigns yet.</p>
          )}
        </div>

        {/* Right — editor */}
        <div className="min-w-0">
          {selected === ADD || !current ? (
            <SessionForm key="add" linkOptions={linkOptions} />
          ) : (
            <SessionForm key={current.id} session={current} linkOptions={linkOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2027-04-30" → "Apr 30, 2027". Parsed as UTC so the day can't shift with the viewer's zone. */
function formatCampaignDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return iso && !Number.isNaN(d.getTime()) ? dateFmt.format(d) : "No date";
}

/**
 * One row in the campaign list: drag handle, the campaign itself as a select button, and ↑↓.
 *
 * The arrows aren't redundant with dragging — they're the only way to reorder by keyboard, and
 * HTML5 drag events are mouse-only.
 */
function CampaignRow({
  session,
  index,
  total,
  past,
  active,
  onSelect,
  onMove,
  onDrop,
}: {
  session: Session;
  index: number;
  total: number;
  past: boolean;
  active: boolean;
  onSelect: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrop: (dragId: string, targetId: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", session.id)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer.getData("text/plain"), session.id);
      }}
      className={[
        "group flex items-center gap-2 rounded-lg p-2 transition-colors",
        over ? "bg-brand-50 ring-2 ring-brand-500/40" : "",
        active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-elevated/60",
        past && !active ? "opacity-70" : "",
      ].join(" ")}
    >
      <span className="cursor-grab text-muted-light active:cursor-grabbing" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-gradient-to-br from-brand-600 to-brand-800">
          {session.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.image} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-sm font-semibold ${active ? "text-brand-700" : "text-fg"}`}
          >
            {session.title || "Untitled campaign"}
          </span>
          <span className="block truncate text-xs text-muted">
            {formatCampaignDate(session.date)}
            {session.venue ? ` · ${session.venue}` : ""}
          </span>
        </span>
      </button>

      {past && (
        <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">
          Past
        </span>
      )}

      <span className="flex flex-col">
        <button
          type="button"
          onClick={() => onMove(session.id, -1)}
          disabled={index === 0}
          aria-label={`Move ${session.title || "campaign"} up`}
          className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(session.id, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${session.title || "campaign"} down`}
          className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
        >
          ↓
        </button>
      </span>
    </li>
  );
}

/** Below this the storefront card visibly upscales the photo. Advisory, not a hard limit. */
const RECOMMENDED_EDGE = 600;

const TABS = [
  { id: "card", label: "Card", hint: "What shows in the campaign list" },
  { id: "page", label: "Session page", hint: "What “Learn more” opens" },
  { id: "photo", label: "Photo", hint: "The card and page image" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * One form for both add and edit — the only difference is the hidden `id`, which is what
 * `saveSessionAction` branches on.
 */
function SessionForm({
  session,
  linkOptions,
}: {
  session?: Session;
  linkOptions: LinkOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveSessionAction, {});
  const editing = Boolean(session);
  const [tab, setTab] = useState<Tab>("card");

  return (
    <div className="space-y-6">
      <Panel
        title={editing ? session?.title || "Untitled campaign" : "Add a campaign"}
        description="Title and date are required. Anything left blank simply isn't shown."
        actions={
          session && (
            <Link
              href={sessionHref(session)}
              target="_blank"
              prefetch={false}
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View on site ↗
            </Link>
          )
        }
      >
        <form
          action={action}
          // The tabs only HIDE fields — every one stays mounted and posts. But the browser can't
          // point at a required field on a hidden tab, so an invalid one switches to its tab first.
          onInvalidCapture={(e) => {
            const owner = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]");
            const id = owner?.dataset.tab as Tab | undefined;
            if (id && id !== tab) setTab(id);
          }}
        >
          {session && <input type="hidden" name="id" value={session.id} />}

          <div
            role="tablist"
            aria-label="Campaign fields"
            className="-mt-1 mb-6 grid grid-cols-3 gap-1 rounded-xl bg-elevated p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`campaign-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-left transition-colors ${
                  tab === t.id ? "bg-surface shadow-sm" : "hover:bg-surface/60"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    tab === t.id ? "text-brand-700" : "text-fg"
                  }`}
                >
                  {t.label}
                </span>
                <span className="hidden truncate text-xs text-muted sm:block">{t.hint}</span>
              </button>
            ))}
          </div>

          <div id="campaign-card" role="tabpanel" data-tab="card" hidden={tab !== "card"} className="space-y-6">
            <FormSection title="About">
              <Field label="Title" hint="What the session is called, e.g. Intraoral Scanning Workshop.">
                <TextInput name="title" defaultValue={session?.title ?? ""} required />
              </Field>
              <Field label="Description" hint="A short paragraph shown on the card.">
                <TextArea name="summary" rows={4} defaultValue={session?.summary ?? ""} />
              </Field>
              <Field
                label="Highlights"
                hint="Short bullet lines — what attendees get. Two to four works best."
                group
              >
                <RepeatableText
                  name="highlight"
                  initial={session?.highlights ?? []}
                  rows={2}
                  placeholder="Certificate of completion accepted toward CE requirements"
                  addLabel="Add highlight"
                />
              </Field>
            </FormSection>

            <FormSection title="When & where">
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Date"
                  hint="Only month and year show publicly. The day sets the order, and when it drops off."
                >
                  <TextInput type="date" name="date" defaultValue={session?.date ?? ""} required />
                </Field>
                <Field label="Time" hint="Free text.">
                  <TextInput
                    name="time"
                    defaultValue={session?.time ?? ""}
                    placeholder="9:00 AM – 12:00 PM"
                  />
                </Field>
                <Field label="Venue">
                  <TextInput
                    name="venue"
                    defaultValue={session?.venue ?? ""}
                    placeholder="Makati City, or Online via Zoom"
                  />
                </Field>
                <Field label="Format">
                  <Select name="format" defaultValue={session?.format ?? "in-person"}>
                    <option value="in-person">In person</option>
                    <option value="online">Online</option>
                  </Select>
                </Field>
                <Field label="Speaker" hint="Who runs it.">
                  <TextInput
                    name="speaker"
                    defaultValue={session?.speaker ?? ""}
                    placeholder="Dr. Marco Cruz"
                  />
                </Field>
                <Field label="Partner brand" hint="Brand running it with us.">
                  <TextInput
                    name="partnerBrand"
                    defaultValue={session?.partnerBrand ?? ""}
                    placeholder="Rundeer"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Seats & fee">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Fee" hint="Shown as written — “Free” works.">
                  <TextInput name="fee" defaultValue={session?.fee ?? ""} placeholder="Free" />
                </Field>
                <Field label="Seats left" hint="Blank = not tracked.">
                  <TextInput
                    type="number"
                    min="0"
                    name="seatsLeft"
                    defaultValue={session?.seatsLeft ?? ""}
                  />
                </Field>
                <Field label="Capacity" hint="Total seats.">
                  <TextInput
                    type="number"
                    min="0"
                    name="capacity"
                    defaultValue={session?.capacity ?? ""}
                  />
                </Field>
              </div>
            </FormSection>

            {/* The two buttons on the card, each with its own wording and destination. */}
            <FormSection
              title="Card buttons"
              description="Start typing in a link box to pick one of your own pages, or paste any address."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Button 1 text" hint="Blank shows “Learn more”.">
                  <TextInput
                    name="detailsLabel"
                    defaultValue={session?.detailsLabel ?? ""}
                    placeholder="Learn more"
                  />
                </Field>
                <Field label="Button 1 link" hint="Blank opens this session's own page.">
                  <LinkField
                    name="detailsHref"
                    defaultValue={session?.detailsHref ?? ""}
                    options={linkOptions}
                    placeholder="This session's page"
                  />
                </Field>
                <Field label="Button 2 text" hint="Blank shows “Reserve a seat”.">
                  <TextInput
                    name="registerLabel"
                    defaultValue={session?.registerLabel ?? ""}
                    placeholder="Reserve a seat"
                  />
                </Field>
                <Field label="Button 2 link" hint="Blank sends people to /contact.">
                  <LinkField
                    name="registerHref"
                    defaultValue={session?.registerHref ?? ""}
                    options={linkOptions}
                    placeholder="/contact"
                  />
                </Field>
              </div>
            </FormSection>
          </div>

          {/* ---- Everything here fills the session's own page (the Learn more destination). ---- */}
          <div id="campaign-page" role="tabpanel" data-tab="page" hidden={tab !== "page"} className="space-y-6">
            <p className="rounded-lg bg-brand-50/60 px-4 py-3 text-sm text-muted">
              Every field here is optional. A section left blank is left off the page entirely
              rather than shown empty.
            </p>

            <FormSection title="Overview">
              <Field
                label="About this session"
                hint="The long description. Blank falls back to the card description."
              >
                <TextArea name="about" rows={6} defaultValue={session?.about ?? ""} />
              </Field>
              <Field label="Who should attend" hint="One paragraph describing the right audience.">
                <TextArea
                  name="audience"
                  rows={3}
                  defaultValue={session?.audience ?? ""}
                  placeholder="General dentists and specialists who want to add soft-tissue laser procedures — no prior experience required."
                />
              </Field>
              <Field label="Format note" hint="How the day runs, in words.">
                <TextInput
                  name="formatNote"
                  defaultValue={session?.formatNote ?? ""}
                  placeholder="Lecture in the morning, hands-on workshop in the afternoon"
                />
              </Field>
            </FormSection>

            <FormSection title="Schedule" description="The running order. Blank rows are dropped; a row without a time is fine.">
              <ScheduleEditor initial={session?.schedule ?? []} />
            </FormSection>

            <FormSection title="What's included">
              <Field label="Items" hint="What a seat actually buys — one per box." group>
                <RepeatableText
                  name="included"
                  initial={session?.included ?? []}
                  rows={2}
                  placeholder="All training materials and use of the units"
                  addLabel="Add item"
                />
              </Field>
              <Field label="Certificate note" hint="Highlighted under the items.">
                <TextInput
                  name="certificateNote"
                  defaultValue={session?.certificateNote ?? ""}
                  placeholder="Certificate of completion issued by ..."
                />
              </Field>
            </FormSection>

            <FormSection title="Pricing & dates">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Pricing note" hint="Under the fee, e.g. early-bird terms.">
                  <TextInput
                    name="feeNote"
                    defaultValue={session?.feeNote ?? ""}
                    placeholder="Early-bird rates for groups of two or more"
                  />
                </Field>
                <Field label="Date note" hint="Replaces the date shown, when the day isn't set.">
                  <TextInput
                    name="dateNote"
                    defaultValue={session?.dateNote ?? ""}
                    placeholder="April 2027 (exact day to be announced)"
                  />
                </Field>
              </div>
              <Field label="Payment terms" hint="One term per box. Shown in its own box." group>
                <RepeatableText
                  name="payment"
                  initial={session?.payment ?? []}
                  rows={2}
                  placeholder="50% down payment to reserve your seat"
                  addLabel="Add term"
                />
              </Field>
            </FormSection>
          </div>

          <div id="campaign-photo" role="tabpanel" data-tab="photo" hidden={tab !== "photo"}>
            <FormSection
              title="Photo"
              description="Optional. Without one, the card shows a branded panel. Saved as WebP."
            >
              <div className="max-w-md">
                <ImageInput
                  name="image"
                  current={session?.image}
                  stacked
                  aspect="aspect-[4/3]"
                  removeName="removeImage"
                  removeLabel="Remove the current photo"
                  minEdge={RECOMMENDED_EDGE}
                  hint="Any image · up to 5 MB · at least 200px on the short side"
                />
              </div>
            </FormSection>
          </div>

          <SaveBar
            state={state}
            label={editing ? "Save campaign" : "Add campaign"}
            pendingLabel={editing ? "Saving…" : "Adding…"}
          />
        </form>
      </Panel>

      {session && (
        <Panel tone="danger" title="Delete this campaign" description="It's removed from the storefront and from this list.">
          <form
            action={deleteSessionAction}
            onSubmit={(e) => {
              if (!confirm(`Delete “${session.title}”? This can't be undone.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={session.id} />
            <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
              Delete campaign
            </SubmitButton>
          </form>
        </Panel>
      )}
    </div>
  );
}
