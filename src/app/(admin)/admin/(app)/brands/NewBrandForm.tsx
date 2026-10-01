"use client";

import { useActionState } from "react";
import { createBrandAction } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, FormMessage, ImageInput, SubmitButton, TextInput } from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";

/** The "Add a brand" panel the Brands page opens inline. */
export function NewBrandForm() {
  const [state, action] = useActionState<ActionState, FormData>(createBrandAction, {});

  return (
    <form action={action}>
      <Panel
        title="Add a brand"
        description="It starts as a draft, hidden from the storefront until you publish it. You can add the story, products and more right after."
        footer={
          <>
            <SubmitButton size="sm">Create brand</SubmitButton>
            <FormMessage state={state} inline />
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Brand name"
            hint="The URL is made from this: “SOL Laser” → /brands/sol-laser"
          >
            <TextInput name="name" required placeholder="e.g. Dentium" />
          </Field>
          <Field label="Logo" hint="Optional. You can add it later." group>
            <ImageInput name="logo" shape="logo" hint="PNG, JPG or WebP · up to 5 MB" />
          </Field>
        </div>
      </Panel>
    </form>
  );
}
