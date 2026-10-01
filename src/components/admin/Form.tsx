"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/form-data";

/** Submit button that disables and relabels itself while its form is pending. */
export function SubmitButton({
  children = "Save changes",
  variant = "primary",
  size = "md",
  pendingLabel = "Saving…",
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "border border-line bg-surface text-fg hover:bg-elevated",
    danger: "border border-danger/30 bg-surface text-danger hover:bg-danger/5",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        size === "sm" ? "px-3.5 py-2 text-sm" : "px-5 py-2.5 text-sm"
      } ${styles}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Result banner for a section form. Renders nothing until the action has run once.
 *
 * `inline` is the compact form that sits beside a button in a `SaveBar` or panel footer.
 */
export function FormMessage({ state, inline = false }: { state: ActionState; inline?: boolean }) {
  if (!state.ok && !state.error) return null;
  if (inline) {
    return (
      <p
        role="status"
        className={`text-sm font-medium ${state.error ? "text-danger" : "text-success"}`}
      >
        {state.error ? "" : "✓ "}
        {state.error ?? state.ok}
      </p>
    );
  }
  return (
    <p
      role="status"
      className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
        state.error
          ? "bg-danger/10 text-danger"
          : "bg-success/10 text-success"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/**
 * The save row at the bottom of a long form — sticks to the bottom of the screen while the form is
 * in view, so "Save" is never a scroll away. Put it as the form's LAST child inside a padded
 * `Panel`; the negative margins pull it out to the panel's edges.
 */
export function SaveBar({
  state,
  label = "Save changes",
  pendingLabel,
  children,
}: {
  state?: ActionState;
  label?: ReactNode;
  pendingLabel?: string;
  /** Extra controls after the save button, e.g. a secondary "Cancel". */
  children?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-8 flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-line bg-surface/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
      <SubmitButton pendingLabel={pendingLabel}>{label}</SubmitButton>
      {children}
      {state && <FormMessage state={state} inline />}
    </div>
  );
}

/**
 * Image picker with a preview — the one replacement for every bare `<input type="file">` in the
 * admin.
 *
 * Still a real file input under `name`, so the server actions read exactly what they read before;
 * it is visually hidden (not `display: none`, which would also switch off `required`). The preview
 * shows the picked file the moment it's chosen, falling back to the current image.
 *
 * `removeName` adds the "remove the current image" toggle many editors have, posting `value="1"`
 * under that name — again exactly what the existing actions expect.
 *
 * React 19 resets a form after its action succeeds, which empties the file input but not this
 * component's state. Listening for the form's `reset` event keeps the preview honest.
 */
export function ImageInput({
  name,
  current,
  hint,
  required,
  multiple,
  shape = "wide",
  removeName,
  removeLabel = "Remove the current image",
  accept = "image/*",
  stacked = false,
  aspect,
  minEdge,
}: {
  name: string;
  /** URL of the image already saved, if any. */
  current?: string;
  hint?: string;
  required?: boolean;
  multiple?: boolean;
  /** wide 16:9 photo · square · logo (contained on white). */
  shape?: "wide" | "square" | "logo";
  removeName?: string;
  removeLabel?: string;
  accept?: string;
  /** Full-width preview above the controls — for images whose whole frame matters (banners). */
  stacked?: boolean;
  /** Tailwind aspect class for the stacked preview, e.g. "aspect-[1489/551]". */
  aspect?: string;
  /**
   * Show the image's real pixel size, and warn when its shorter side is under this. A tiny upload
   * is otherwise accepted silently and then stretched blurry across a card, with no hint why.
   */
  minEdge?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ url: string; name: string }[]>([]);
  const [removing, setRemoving] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const small = minEdge !== undefined && dims !== null && Math.min(dims.w, dims.h) < minEdge;

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setPicked([]);
      setRemoving(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const choose = (files: FileList | null) => {
    setPicked(Array.from(files ?? []).map((f) => ({ url: URL.createObjectURL(f), name: f.name })));
    setRemoving(false);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPicked([]);
  };

  const shown = picked[0]?.url ?? (removing ? undefined : current);
  const frame = stacked
    ? `${aspect ?? "aspect-[16/9]"} w-full`
    : {
        wide: "aspect-[16/9] w-36 sm:w-44",
        square: "aspect-square w-24",
        logo: "aspect-[2/1] w-36 bg-white",
      }[shape];

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-dashed border-line-strong bg-bg/60 p-3 ${
        stacked ? "" : "sm:flex-row sm:items-center"
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded-lg border border-line ${frame} ${
          shape === "logo" ? "" : "bg-elevated"
        }`}
      >
        {shown ? (
          // A blob: URL or an arbitrary saved URL, at thumbnail size — next/image buys nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            onLoad={(e) =>
              setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            className={`h-full w-full ${shape === "logo" ? "object-contain p-2" : "object-cover"}`}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted-light">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5h16v14H4V5Zm0 10 4-4 3 3 4-5 5 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {removing ? "Will be removed" : "No image"}
          </span>
        )}
        {picked.length > 1 && (
          <span className="absolute bottom-1 right-1 rounded-full bg-fg/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            +{picked.length - 1}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-fg transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 hover:bg-elevated">
            <input
              ref={inputRef}
              type="file"
              name={name}
              accept={accept}
              required={required}
              multiple={multiple}
              onChange={(e) => choose(e.target.files)}
              className="sr-only"
            />
            {picked.length > 0
              ? "Choose another"
              : current
                ? multiple
                  ? "Add images"
                  : "Replace image"
                : multiple
                  ? "Choose images"
                  : "Choose image"}
          </label>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-2.5 py-2 text-sm font-semibold text-muted hover:text-fg"
            >
              Clear
            </button>
          )}
        </div>
        <p className="truncate text-xs text-muted">
          {picked.length === 1
            ? picked[0].name
            : picked.length > 1
              ? `${picked.length} images selected`
              : hint}
        </p>
        {minEdge !== undefined && dims && shown && (
          <p className={`text-xs ${small ? "font-semibold text-danger" : "text-muted"}`}>
            {dims.w} × {dims.h} px
            {small && ` · too small, it will look blurry. Use at least ${minEdge}px on the short side.`}
          </p>
        )}
        {removeName && current && picked.length === 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              name={removeName}
              value="1"
              checked={removing}
              onChange={(e) => setRemoving(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            {removeLabel}
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * A label, an optional hint, then the control.
 *
 * `group` renders a <div> instead of a <label>: use it when the children hold their own labels or
 * several controls (an `ImageInput`, a row of buttons). Nested labels are invalid, and a wrapping
 * label forwards every click inside it to the first control.
 */
export function Field({
  label,
  hint,
  group = false,
  children,
}: {
  label: string;
  hint?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </Tag>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

/**
 * A list of text rows the editor can grow or shrink. All rows post under the same field `name`,
 * so the server action reads them with `formData.getAll(name)`.
 *
 * The boxes are CONTROLLED. They used to be uncontrolled (`defaultValue`) while keyed by array
 * index, and those two together silently rearranged the editor's text: React matches rows by key,
 * so deleting row 0 of ["a", "b"] left the DOM node for index 0 in place — still showing "a",
 * because `defaultValue` is ignored on re-render — and unmounted the *last* box instead. You
 * deleted the first paragraph and watched the second one disappear. Whatever you retyped to
 * recover then fought the same mismatch, which is an easy way to end up saving nothing at all.
 *
 * Holding the text in state means the value React renders is the value that posts, and removal
 * drops the row you actually clicked.
 */
export function RepeatableText({
  name,
  initial,
  placeholder,
  addLabel,
  rows = 3,
}: {
  name: string;
  initial: string[];
  placeholder?: string;
  addLabel: string;
  rows?: number;
}) {
  const [values, setValues] = useState<string[]>(initial.length ? initial : [""]);

  return (
    <div className="space-y-3">
      {values.map((value, i) => (
        <div key={i} className="flex gap-2">
          <TextArea
            name={name}
            rows={rows}
            value={value}
            onChange={(e) =>
              setValues((v) => v.map((old, idx) => (idx === i ? e.target.value : old)))
            }
            placeholder={placeholder}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setValues((v) => v.filter((_, idx) => idx !== i))}
            aria-label={`Remove item ${i + 1}`}
            className="h-fit rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-danger"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setValues((v) => [...v, ""])}
        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        + {addLabel}
      </button>
    </div>
  );
}

/** Paired title/body rows for "Why choose this brand?". */
export function RepeatablePairs({
  initial,
  addLabel,
}: {
  initial: { title: string; body: string }[];
  addLabel: string;
}) {
  const [rows, setRows] = useState(initial.length ? initial : [{ title: "", body: "" }]);

  // Controlled for the same reason as RepeatableText above — see that comment.
  const edit = (i: number, patch: Partial<{ title: string; body: string }>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-line bg-bg p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-3">
              <TextInput
                name="reasonTitle"
                value={row.title}
                onChange={(e) => edit(i, { title: e.target.value })}
                placeholder="Reason headline"
              />
              <TextArea
                name="reasonBody"
                rows={2}
                value={row.body}
                onChange={(e) => edit(i, { body: e.target.value })}
                placeholder="One or two sentences of detail"
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
              aria-label={`Remove reason ${i + 1}`}
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-danger"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { title: "", body: "" }])}
        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        + {addLabel}
      </button>
    </div>
  );
}
