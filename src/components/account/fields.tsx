"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Form controls shared by the sign-in and sign-up forms.
 *
 * Same visual language as the storefront's other forms (see ContactForm) — a bordered surface
 * input with the brand focus ring — pulled into components here because the register form has
 * eight of them and repeats a label/hint/error structure each time.
 */

export const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none " +
  "placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/**
 * Label + optional hint above a control.
 *
 * `mt-auto` on the control is what keeps a side-by-side pair aligned. Grid items stretch to the
 * row's height by default, so a field whose neighbour has a hint (or a label that wraps to two
 * lines) would otherwise sit that much higher than it — the auto margin absorbs the difference and
 * sits every input on the same baseline. Harmless in a single-column form, where there is no free
 * space for it to take up.
 */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex h-full flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </span>
      {hint && <span className="-mt-0.5 text-xs text-muted">{hint}</span>}
      <div className="mt-auto">{children}</div>
    </label>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

/** Password input with a show/hide toggle — long passwords are mistyped without one. */
export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? "text" : "password"}
        className={`${fieldClass} pr-16 ${props.className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-brand-700 hover:text-brand-800"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/**
 * File picker for the PRC ID photo.
 *
 * The native control is hidden behind a styled label because its default rendering can't be
 * themed, and because the chosen filename needs to be shown somewhere the visitor will notice —
 * uploading the wrong photo is otherwise only discovered when verification fails.
 */
export function ImageInput({
  name,
  accept,
  required,
  hint,
}: {
  name: string;
  accept: string;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [fileName, setFileName] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">
        PRC ID photo
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </span>
      {hint && <span className="-mt-0.5 text-xs text-muted">{hint}</span>}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line bg-bg px-3.5 py-3">
        <label
          htmlFor={id}
          className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-fg hover:bg-elevated"
        >
          Choose file
        </label>
        <input
          id={id}
          type="file"
          name={name}
          accept={accept}
          required={required}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="sr-only"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {fileName || "No file chosen"}
        </span>
      </div>
    </div>
  );
}
