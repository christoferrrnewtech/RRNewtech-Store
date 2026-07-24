"use client";

import { useActionState } from "react";
import { createBrandAction, type ActionState } from "@/app/(admin)/admin/actions";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

/** The "create a brand" panel shown in the right column when no brand is selected. */
export function NewBrandForm() {
  const [state, action] = useActionState<ActionState, FormData>(createBrandAction, {});

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
            Add a brand
          </h2>
          <p className="mt-1 text-sm text-muted">
            It starts as a draft — invisible on the storefront until you publish it. You can fill in
            the logo, story, products and more right after.
          </p>
        </div>
      </div>

      <form action={action} className="mt-6 space-y-5">
        <Field label="Brand name" hint="The URL is generated from this, e.g. “SOL Laser” → /brands/sol-laser">
          <TextInput name="name" required placeholder="e.g. Dentium" />
        </Field>

        <Field label="Logo" hint="PNG, JPG or WebP · up to 5 MB. You can add this later.">
          <TextInput type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
        </Field>

        <SubmitButton>Create brand</SubmitButton>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
