"use client";

import { useFormStatus } from "react-dom";
import { useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/form-data";

/** Submit button that disables and relabels itself while its form is pending. */
export function SubmitButton({
  children = "Save changes",
  variant = "primary",
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Result banner for a section form. Renders nothing until the action has run once. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.ok && !state.error) return null;
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

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
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
            defaultValue={value}
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

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-line bg-bg p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-3">
              <TextInput
                name="reasonTitle"
                defaultValue={row.title}
                placeholder="Reason headline"
              />
              <TextArea
                name="reasonBody"
                rows={2}
                defaultValue={row.body}
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
