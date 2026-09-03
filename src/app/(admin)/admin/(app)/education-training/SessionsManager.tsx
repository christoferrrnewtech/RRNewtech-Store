"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveSessionAction,
  deleteSessionAction,
  reorderSessionsAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import {
  Field,
  FormMessage,
  RepeatableText,
  SubmitButton,
  TextInput,
  TextArea,
  Select,
} from "@/components/admin/Form";
import type { Session } from "@/components/education/Sessions";

const ADD = "add" as const;
type Selection = string | typeof ADD;

/** Today in Manila, for flagging past campaigns in the list. Matches `getSessions`' cutoff. */
function todayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function SessionsManager({ sessions }: { sessions: Session[] }) {
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

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      {/* Left — campaign list */}
      <div className="mb-6 lg:mb-0">
        <button
          type="button"
          onClick={() => setSelected(ADD)}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            selected === ADD
              ? "bg-brand-700 text-white"
              : "bg-brand-600 text-white hover:bg-brand-700",
          ].join(" ")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Add campaign
        </button>

        {items.length > 0 && (
          <>
            <p className="mt-4 text-xs text-muted">
              Drag a campaign, or use the arrows, to set the order shown on the storefront.
            </p>
            <ul className="mt-2 space-y-2">
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
          </>
        )}
      </div>

      {/* Right — editor */}
      <div>
        {selected === ADD || !current ? (
          <SessionForm key="add" />
        ) : (
          <SessionForm key={current.id} session={current} />
        )}
      </div>
    </div>
  );
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
        "flex items-center gap-2 rounded-xl border bg-surface p-2 transition-colors",
        over ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line",
        active ? "bg-brand-50 ring-1 ring-brand-600" : "hover:border-line-strong",
      ].join(" ")}
    >
      <span className="cursor-grab text-muted-light active:cursor-grabbing" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-fg">
          {session.title || "Untitled campaign"}
        </span>
        <span className="block text-xs text-muted">
          {session.date || "No date"}
          {session.venue ? ` · ${session.venue}` : ""}
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

/**
 * The photo currently attached, with its real pixel size read off the loaded element.
 *
 * The size readout is the point: a 46×46 upload was accepted silently and then stretched across a
 * 460px card, and nothing in the admin gave any hint why the result looked blurry.
 */
function CurrentPhoto({ image }: { image?: string }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const small = dims !== null && Math.min(dims.w, dims.h) < RECOMMENDED_EDGE;

  return (
    <div>
      <p className="text-sm font-semibold text-fg">Current photo</p>
      <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-elevated">
        {image ? (
          /* Plain <img>: a remote Storage URL, and `naturalWidth` needs the real element. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image}
            alt="Current campaign photo"
            onLoad={(e) =>
              setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm text-muted">
            No photo — the card will show a branded panel instead.
          </div>
        )}
      </div>
      {dims && (
        <p className={["mt-2 text-xs", small ? "font-semibold text-danger" : "text-muted"].join(" ")}>
          {dims.w} × {dims.h} px
          {small && ` — too small, this will look blurry. Upload at least ${RECOMMENDED_EDGE}px wide.`}
        </p>
      )}
    </div>
  );
}

/**
 * One form for both add and edit — the only difference is the hidden `id`, which is what
 * `saveSessionAction` branches on.
 */
function SessionForm({ session }: { session?: Session }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSessionAction, {});
  const editing = Boolean(session);

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        {editing ? "Edit campaign" : "Add a campaign"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Title and date are required. Everything else is optional — leave a field blank and it simply
        doesn&apos;t show on the card.
      </p>

      <form action={action} className="mt-5 space-y-4">
        {session && <input type="hidden" name="id" value={session.id} />}

        <Field label="Title" hint="What the session is called, e.g. Intraoral Scanning Workshop.">
          <TextInput name="title" defaultValue={session?.title ?? ""} required />
        </Field>

        <Field label="Description" hint="A short paragraph shown on the card.">
          <TextArea name="summary" rows={4} defaultValue={session?.summary ?? ""} />
        </Field>

        <Field
          label="Highlights"
          hint="Short bullet lines on the card — what attendees get. Two to four works best; leave empty for none."
        >
          <RepeatableText
            name="highlight"
            initial={session?.highlights ?? []}
            rows={2}
            placeholder="Certificate of completion accepted toward CE requirements"
            addLabel="Add highlight"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            hint="Only the month and year are shown publicly — the day still sets the order and drops the campaign off the storefront once it passes."
          >
            <TextInput type="date" name="date" defaultValue={session?.date ?? ""} required />
          </Field>
          <Field label="Time" hint="Free text, e.g. 9:00 AM – 12:00 PM.">
            <TextInput name="time" defaultValue={session?.time ?? ""} placeholder="9:00 AM – 12:00 PM" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue" hint="Where it happens, e.g. Makati City or Online via Zoom.">
            <TextInput name="venue" defaultValue={session?.venue ?? ""} placeholder="Makati City" />
          </Field>
          <Field label="Format">
            <Select name="format" defaultValue={session?.format ?? "in-person"}>
              <option value="in-person">In person</option>
              <option value="online">Online</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Speaker" hint="Who runs it, e.g. Dr. Marco Cruz.">
            <TextInput name="speaker" defaultValue={session?.speaker ?? ""} />
          </Field>
          <Field label="Partner brand" hint="Brand running it with us, e.g. Rundeer.">
            <TextInput name="partnerBrand" defaultValue={session?.partnerBrand ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fee" hint='Shown as written — "Free" works.'>
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

        <Field
          label="Registration link"
          hint="Your form, a Facebook event, or a page path. Blank sends people to /contact."
        >
          <TextInput
            name="registerHref"
            defaultValue={session?.registerHref ?? ""}
            placeholder="/contact"
          />
        </Field>

        <CurrentPhoto image={session?.image} />

        <Field
          label={editing ? "Replace photo" : "Photo"}
          hint="Any image file · up to 5 MB, at least 200px on its shorter side. Saved as WebP. Optional — without one the card shows a branded panel."
        >
          <TextInput type="file" name="image" accept="image/*" />
        </Field>

        {session?.image && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="removeImage" value="1" />
            Remove the current photo
          </label>
        )}

        <SubmitButton>{editing ? "Save campaign" : "Add campaign"}</SubmitButton>
        <FormMessage state={state} />
      </form>

      {session && (
        <form action={deleteSessionAction} className="mt-6 border-t border-line pt-4">
          <input type="hidden" name="id" value={session.id} />
          <SubmitButton variant="danger">Delete this campaign</SubmitButton>
        </form>
      )}
    </div>
  );
}
