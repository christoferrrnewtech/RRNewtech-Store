"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/form-data";

/**
 * Storefront equivalents of the admin's SubmitButton/FormMessage.
 *
 * Separate from `components/admin/Form.tsx` rather than shared: these wear the storefront's
 * `Button` and speak to customers ("Sending…", not "Saving…"). What they do share is the
 * `ActionState` contract, so both sides read an action's result the same way.
 */

/** Submit button that disables and relabels itself while its form is pending. */
export function SubmitButton({
  children,
  pendingLabel = "Sending…",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Result banner. Renders nothing until the action has run once. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-4 py-2.5 text-sm ${
        state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/**
 * Honeypot. Hidden from sight and from assistive tech, and excluded from tab order — a human
 * never fills it, so anything that does is a bot and the action silently discards the submission.
 * `sr-only` is deliberately NOT used: screen readers would announce it and users would fill it in.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label>
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
