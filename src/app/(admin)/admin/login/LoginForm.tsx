"use client";

import { useActionState } from "react";
import { loginAction, } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-6">
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton>Sign in</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
