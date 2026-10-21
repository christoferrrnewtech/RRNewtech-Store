"use client";

import { useFormStatus } from "react-dom";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/form-data";
import {
  EMAIL_PATTERN,
  looksLikeEmail,
  MAX_EMAIL,
  normalizePhone,
  PHONE_MAX_LENGTH,
  PHONE_PATTERN,
} from "@/lib/customer-fields";

/**
 * The red "*" after a required field's label — same mark as the account forms' `Field`. Hidden
 * from screen readers, which already announce the input's `required`.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger">
      *
    </span>
  );
}

/** Red border on a field the browser-side check has flagged. Attribute + class outranks focus:. */
const INVALID =
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:border-danger aria-[invalid=true]:focus:ring-danger/20";

type InputProps = Omit<ComponentProps<"input">, "type">;

/**
 * An input that checks itself the moment the visitor leaves it, rather than only on submit — a
 * typo caught while they're still on the form is one they fix, not a reply that never arrives.
 *
 * Quiet until the first blur, so nobody is told off mid-word; once an error is showing it
 * re-checks on every keystroke, so it clears the moment the value becomes valid. An empty field is
 * left to `required` — tabbing past a blank box isn't a mistake yet.
 *
 * The message is also set as the field's custom validity, so the browser's own bubble on submit
 * (pressing Enter without ever leaving the field) says the same thing rather than a generic
 * "match the requested format" — and `onInvalid` shows the inline line in that case too.
 */
function CheckedInput({
  type,
  isValid,
  message,
  className = "",
  onBlur,
  onChange,
  onInvalid,
  "aria-describedby": describedBy,
  ...props
}: InputProps & {
  type: "email" | "tel";
  isValid: (value: string) => boolean;
  message: string;
}) {
  const errorId = useId();
  const [error, setError] = useState("");

  const check = (el: HTMLInputElement) => {
    const value = el.value.trim();
    const next = !value || isValid(value) ? "" : message;
    el.setCustomValidity(next);
    setError(next);
  };

  return (
    <>
      <input
        {...props}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error && errorId].filter(Boolean).join(" ") || undefined}
        className={`${className} ${INVALID}`}
        onBlur={(e) => {
          check(e.currentTarget);
          onBlur?.(e);
        }}
        onChange={(e) => {
          if (error) check(e.currentTarget);
          onChange?.(e);
        }}
        onInvalid={(e) => {
          check(e.currentTarget);
          onInvalid?.(e);
        }}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs font-normal text-danger">
          {error}
        </span>
      )}
    </>
  );
}

/** Email input, checked on blur. Same `looksLikeEmail` the server actions run. */
export function EmailInput(props: InputProps) {
  return (
    <CheckedInput
      autoComplete="email"
      maxLength={MAX_EMAIL}
      pattern={EMAIL_PATTERN}
      {...props}
      type="email"
      isValid={looksLikeEmail}
      message="Enter a valid email address, like you@email.com."
    />
  );
}

/**
 * PH mobile number input, checked on blur against the server's own `normalizePhone`. Anything
 * that can't be part of a number — letters, brackets, dots — is dropped as it's typed or pasted,
 * and the length is capped at the widest accepted shape.
 */
export function PhoneInput({ onInput, ...props }: InputProps) {
  return (
    <CheckedInput
      inputMode="tel"
      autoComplete="tel"
      maxLength={PHONE_MAX_LENGTH}
      pattern={PHONE_PATTERN}
      {...props}
      type="tel"
      isValid={(value) => normalizePhone(value) !== ""}
      message="Enter a PH mobile number, like 0917-123-4567 or +63 917 123 4567."
      onInput={(e) => {
        const el = e.currentTarget;
        const allowed = el.value.replace(/[^\d+\s-]/g, "");
        if (allowed !== el.value) el.value = allowed;
        onInput?.(e);
      }}
    />
  );
}

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
