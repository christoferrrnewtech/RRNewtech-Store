"use client";

import { useActionState } from "react";
import { loginAction, } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-8 space-y-5 rounded-2xl border border-line bg-surface p-6 sm:p-7">
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      {/* Full width: the one action on the page. */}
      <div className="[&>button]:w-full">
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
