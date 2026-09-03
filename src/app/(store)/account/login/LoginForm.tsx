"use client";

import { useActionState } from "react";
import { loginCustomerAction } from "@/app/(store)/account/actions";
import { FormMessage, SubmitButton } from "@/components/ui/FormControls";
import { Field, PasswordInput, TextInput } from "@/components/account/fields";
import { MAX_EMAIL } from "@/lib/customer-fields";
import type { ActionState } from "@/lib/form-data";

/**
 * Sign-in form. On success the action redirects, so this component only ever renders the empty or
 * errored state — there is no success branch to write.
 *
 * An unverified account is not an error here: the action re-sends the verification link and
 * redirects to /account/verify, because it has just proved the visitor owns the password.
 */
export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginCustomerAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email address" required>
        <TextInput
          name="email"
          type="email"
          autoComplete="username"
          maxLength={MAX_EMAIL}
          required
          autoFocus
          placeholder="you@clinic.ph"
        />
      </Field>

      <Field label="Password" required>
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>

      <FormMessage state={state} />

      <SubmitButton pendingLabel="Signing in…" size="lg" className="mt-1 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
