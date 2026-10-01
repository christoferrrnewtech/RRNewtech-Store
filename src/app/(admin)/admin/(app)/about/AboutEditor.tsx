"use client";

import { useActionState } from "react";
import { saveAboutAction } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, ImageInput, RepeatableText, SaveBar, TextInput } from "@/components/admin/Form";
import { FormSection, Panel } from "@/components/admin/Panel";
import type { AboutContent } from "@/lib/content";

/** Single form editing the homepage About band: the words on the left, the photo on the right. */
export function AboutEditor({ content }: { content: AboutContent }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAboutAction, {});

  return (
    <Panel>
      <form action={action}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <FormSection title="Text">
              <Field label="Eyebrow" hint="Small label above the heading.">
                <TextInput name="eyebrow" defaultValue={content.eyebrow} placeholder="Who we are" />
              </Field>
              <Field label="Heading">
                <TextInput name="heading" defaultValue={content.heading} required />
              </Field>
              <Field label="Body paragraphs" hint="One paragraph per box." group>
                <RepeatableText
                  name="paragraph"
                  initial={content.paragraphs}
                  addLabel="Add paragraph"
                  placeholder="A sentence or two about the business."
                />
              </Field>
            </FormSection>

            <FormSection title="Button" description="Leave the link blank to hide the button.">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Label">
                  <TextInput
                    name="ctaLabel"
                    defaultValue={content.ctaLabel}
                    placeholder="Learn more about us"
                  />
                </Field>
                <Field label="Links to">
                  <TextInput name="ctaHref" defaultValue={content.ctaHref} placeholder="/about" />
                </Field>
              </div>
            </FormSection>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <FormSection
              title="Photo"
              description={
                content.image
                  ? "Shown beside the text."
                  : "No photo yet, so the storefront shows a placeholder."
              }
            >
              <ImageInput
                name="image"
                current={content.image || undefined}
                stacked
                aspect="aspect-[4/3]"
                removeName="removeImage"
                removeLabel="Use the placeholder instead"
                hint="PNG, JPG or WebP · up to 5 MB"
              />
            </FormSection>
          </div>
        </div>

        <SaveBar state={state} label="Save About section" />
      </form>
    </Panel>
  );
}
