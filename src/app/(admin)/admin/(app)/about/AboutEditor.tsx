"use client";

import { useActionState } from "react";
import { saveAboutAction, type ActionState } from "@/app/(admin)/admin/actions";
import {
  Field,
  FormMessage,
  RepeatableText,
  SubmitButton,
  TextInput,
} from "@/components/admin/Form";
import type { AboutContent } from "@/lib/content";

const PLACEHOLDER = "/brand/about.svg";

/** Single form editing the homepage About band. Mirrors the banner EditPanel: preview + fields. */
export function AboutEditor({ content }: { content: AboutContent }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAboutAction, {});
  const preview = content.image || PLACEHOLDER;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form action={action} className="order-2 space-y-4 lg:order-1">
          <Field label="Eyebrow" hint="Small label above the heading.">
            <TextInput name="eyebrow" defaultValue={content.eyebrow} placeholder="Who we are" />
          </Field>

          <Field label="Heading">
            <TextInput name="heading" defaultValue={content.heading} required />
          </Field>

          <Field label="Body paragraphs" hint="One paragraph per box. Add or remove as needed.">
            <RepeatableText
              name="paragraph"
              initial={content.paragraphs}
              addLabel="Add paragraph"
              placeholder="A sentence or two about the business."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button label" hint="Leave the link blank to hide the button.">
              <TextInput name="ctaLabel" defaultValue={content.ctaLabel} placeholder="Learn more about us" />
            </Field>
            <Field label="Button link" hint="Where the button goes, e.g. /about.">
              <TextInput name="ctaHref" defaultValue={content.ctaHref} placeholder="/about" />
            </Field>
          </div>

          <Field label="Replace image" hint="PNG, JPG or WebP · up to 5 MB. Leave empty to keep the current image.">
            <TextInput type="file" name="image" accept="image/png,image/jpeg,image/webp" />
          </Field>

          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" name="removeImage" value="1" className="h-4 w-4 rounded border-line" />
            Use the placeholder image (remove the current photo)
          </label>

          <SubmitButton>Save About section</SubmitButton>
          <FormMessage state={state} />
        </form>

        {/* Live preview of the current image */}
        <div className="order-1 lg:order-2">
          <p className="text-sm font-semibold text-fg">Current image</p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-elevated">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="About section preview" className="aspect-[4/3] w-full object-cover" />
          </div>
          {!content.image && (
            <p className="mt-2 text-xs text-muted">
              Showing the placeholder — upload an image above to replace it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
