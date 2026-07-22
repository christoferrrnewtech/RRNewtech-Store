"use client";

import { useActionState } from "react";
import { createBrandAction, type ActionState } from "@/app/(admin)/admin/actions";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

export function NewBrandForm() {
  const [state, action] = useActionState<ActionState, FormData>(createBrandAction, {});

  return (
    <section className="mt-12">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        Add a brand
      </h2>
      <p className="mt-1 text-sm text-muted">
        It starts as a draft — invisible on the storefront until you publish it.
      </p>

      <form action={action} className="mt-4 space-y-5 rounded-2xl border border-line bg-surface p-6">
        <Field label="Brand name" hint="The URL is generated from this, e.g. “SOL Laser” → /brands/sol-laser">
          <TextInput name="name" required placeholder="e.g. Dentium" />
        </Field>

        <Field label="Logo" hint="PNG, JPG or WebP · up to 5 MB. You can add this later.">
          <TextInput type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
        </Field>

        <SubmitButton>Create brand</SubmitButton>
        <FormMessage state={state} />
      </form>
    </section>
  );
}
