/**
 * Shared server-action plumbing: the result contract every form action returns, and the FormData
 * readers those actions parse input with.
 *
 * This lives in `lib/` rather than inside an actions file because a `"use server"` module may only
 * export async functions — helpers defined there can't be shared. Both the admin actions and the
 * storefront actions import from here so the two speak the same shape.
 *
 * No `server-only` import: `ActionState` is the type client components annotate their
 * `useActionState` calls with, so the module has to be importable from both sides.
 */

/** What every form action resolves to. Actions return errors, they don't throw them. */
export type ActionState = { ok?: string; error?: string };

/** A single text field, trimmed. Missing or non-string entries read as "". */
export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Multi-value text inputs (repeatable rows), with blanks dropped. */
export function textList(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * A text field capped at `max` characters.
 *
 * Public forms write straight to Firestore, so an unbounded textarea is a way to bloat a document
 * (or hit the 1 MiB limit) from the outside. Truncating rather than rejecting keeps a customer who
 * genuinely wrote a long message from losing it entirely.
 */
export function cappedText(form: FormData, key: string, max: number): string {
  return text(form, key).slice(0, max);
}
