"use client";

import { useActionState } from "react";
import { saveBannerAction, type ActionState } from "@/app/(admin)/admin/actions";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";
import type { Banner } from "@/lib/content";

export function BannerForm({ banner }: { banner: Banner }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBannerAction, {});

  return (
    <form action={action} className="mt-6 space-y-5 rounded-2xl border border-line bg-surface p-6">
      <Field label="Replace image" hint="PNG, JPG or WebP · up to 5 MB. Leave empty to keep the current image.">
        <TextInput type="file" name="image" accept="image/png,image/jpeg,image/webp" />
      </Field>

      <Field label="Alt text" hint="Describes the image for screen readers and search engines.">
        <TextInput name="alt" defaultValue={banner.alt} required />
      </Field>

      <Field label="Links to" hint="Where clicking the banner goes, e.g. /brands. Leave empty for no link.">
        <TextInput name="href" defaultValue={banner.href} placeholder="/brands" />
      </Field>

      <SubmitButton />
      <FormMessage state={state} />
    </form>
  );
}
