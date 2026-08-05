"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import {
  deleteBrandAction,
  saveBrandAboutAction,
  saveBrandCtaAction,
  saveBrandGalleryAction,
  saveBrandHeroAction,
  saveBrandLogoAction,
  saveBrandReasonsAction,
  saveBrandStatusAction,
  saveBrandVideoAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import {
  Field,
  FormMessage,
  RepeatablePairs,
  RepeatableText,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/Form";
import type { Brand } from "@/lib/content";
import { BRAND_GROUPS } from "@/lib/constants";
import { Section } from "./Section";

/**
 * The brand page editor. One <form> per section, each bound to its own server action, so a
 * validation failure in one section never discards edits in another.
 *
 * Products are deliberately absent — they live on /admin/brands/[slug]/products, because a brand
 * can carry dozens and inline they buried every other section.
 */
export function BrandEditor({
  brand,
  canDelete,
}: {
  brand: Brand;
  canDelete: boolean;
}) {
  return (
    <div className="mt-8 space-y-6">
      <StatusSection brand={brand} />
      {/* Both are small image uploads — paired so the whole image step fits one screen. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HeroSection brand={brand} />
        <LogoSection brand={brand} />
      </div>
      <AboutSection brand={brand} />
      <VideoSection brand={brand} />
      <GallerySection brand={brand} />
      <ProductsLink brand={brand} />
      <ReasonsSection brand={brand} />
      <CtaSection brand={brand} />

      {canDelete && (
        <section className="rounded-2xl border border-danger/30 bg-surface p-6">
          <h2 className="font-semibold text-fg">Delete this brand</h2>
          <p className="mt-1 text-sm text-muted">
            Removes {brand.name} from the storefront and from every marketing account&rsquo;s
            access. Uploaded images stay on disk. This can&rsquo;t be undone.
          </p>
          <form action={deleteBrandAction} className="mt-4">
            <input type="hidden" name="slug" value={brand.slug} />
            <SubmitButton variant="danger">Delete {brand.name}</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}

function StatusSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandStatusAction, {});
  return (
    <Section
      id="sec-visibility"
      step="—"
      title="Visibility"
      hint="Drafts are hidden everywhere on the storefront and the page returns 404."
    >
      <form action={action} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="Status">
          <select
            name="status"
            defaultValue={brand.status}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="draft">Draft — hidden</option>
            <option value="published">Published — live</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 py-2.5 text-sm text-fg">
          <input
            type="checkbox"
            name="featuredOnHome"
            value="1"
            defaultChecked={brand.featuredOnHome !== false}
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/20"
          />
          Feature this brand on the homepage
        </label>
        <SubmitButton>Update status</SubmitButton>
      </form>
      <p className="mt-2 text-sm text-muted">
        When featured, this brand gets its own product shelf on the homepage “By Brand” view (a
        published brand with at least one product). Uncheck to keep it out of the homepage shelves —
        its brand page stays live.
      </p>
      <FormMessage state={state} />
    </Section>
  );
}

function HeroSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandHeroAction, {});
  return (
    <Section id="sec-hero" step="1" title="Hero banner" hint="Wide image across the top of the brand page. Optional.">
      {brand.heroImage && (
        <div className="relative mb-4 h-28 w-full max-w-sm overflow-hidden rounded-xl border border-line bg-elevated">
          <Image src={brand.heroImage} alt="" fill sizes="384px" className="object-cover" />
        </div>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="Upload image" hint="PNG, JPG or WebP · up to 5 MB. Wide crops work best (3:1).">
          <TextInput type="file" name="heroImage" accept="image/png,image/jpeg,image/webp" />
        </Field>
        <div className="flex items-center gap-4">
          <SubmitButton />
          {brand.heroImage && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="remove" value="1" /> Remove current hero
            </label>
          )}
        </div>
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

function LogoSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandLogoAction, {});
  return (
    <Section id="sec-logo" step="2" title="Brand logo" hint="Shown on the brand card, the brand page and product cards.">
      <div className="relative mb-4 h-28 w-full max-w-sm overflow-hidden rounded-xl border border-line bg-white">
        <Image src={brand.logo} alt={brand.name} fill sizes="384px" className="object-contain p-4" />
      </div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="Replace logo" hint="PNG, JPG or WebP · up to 5 MB.">
          <TextInput type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
        </Field>
        <SubmitButton>Upload logo</SubmitButton>
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

function AboutSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandAboutAction, {});
  return (
    <Section id="sec-about" step="3" title="About the brand" hint="The name, headline and body copy for this brand.">
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="Brand name">
          <TextInput name="name" defaultValue={brand.name} required />
        </Field>
        <Field label="Tagline" hint="One line on the brand card and hero — the reason a clinic cares.">
          <TextInput name="tagline" defaultValue={brand.tagline} />
        </Field>
        <Field label="Group" hint="Drives the category tag on the brand card and the Shop-by-Brand filters.">
          <select
            name="group"
            defaultValue={brand.group}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {BRAND_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Short blurb" hint="1–2 sentences under the hero. Also used as the page description in search results.">
          <TextArea name="blurb" rows={2} defaultValue={brand.blurb} />
        </Field>
        <Field label="Body paragraphs">
          <RepeatableText
            name="about"
            initial={brand.about}
            addLabel="Add paragraph"
            placeholder="Tell the story of this brand…"
          />
        </Field>
        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

function VideoSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandVideoAction, {});
  return (
    <Section
      id="sec-video"
      step="4"
      title="Embedded YouTube video"
      hint="Paste any YouTube link. Leave empty to hide the section."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="YouTube URL">
          <TextInput
            name="youtubeUrl"
            defaultValue={brand.youtubeUrl ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

function GallerySection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandGalleryAction, {});
  return (
    <Section id="sec-gallery" step="5" title="Image gallery" hint="Product shots, clinic photos, before/afters.">
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />

        {brand.gallery.length > 0 && (
          <ul className="space-y-3">
            {brand.gallery.map((img) => (
              <li key={img.src} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-elevated">
                  <Image src={img.src} alt="" fill sizes="96px" className="object-cover" />
                </div>
                {/* Unchecking "keep" blanks the src, which removes the row on save. */}
                <input type="hidden" name="gallerySrc" value={img.src} />
                <TextInput
                  name="galleryCaption"
                  defaultValue={img.caption ?? ""}
                  placeholder="Caption (optional)"
                  className="flex-1"
                />
              </li>
            ))}
          </ul>
        )}

        <Field label="Add images" hint="Select one or more. PNG, JPG or WebP · up to 5 MB each.">
          <TextInput
            type="file"
            name="newImages"
            accept="image/png,image/jpeg,image/webp"
            multiple
          />
        </Field>

        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

/**
 * Products keep their slot in the numbered sequence, but the editor itself lives on its own route.
 * This card is the in-page signpost so step 6 doesn't just vanish from the flow.
 */
function ProductsLink({ brand }: { brand: Brand }) {
  const count = brand.products.length;
  return (
    <Section
      id="sec-products"
      step="6"
      title="Products"
      hint="The products shown on this brand's page — edited on their own page, since there can be a lot of them."
    >
      <Link
        href={`/admin/brands/${brand.slug}/products`}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Edit {count} product{count === 1 ? "" : "s"} →
      </Link>
    </Section>
  );
}

function ReasonsSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandReasonsAction, {});
  return (
    <Section
      id="sec-reasons"
      step="7"
      title="Why choose this brand?"
      hint="Three works best. A row with an empty headline is dropped on save."
    >
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />
        <RepeatablePairs initial={brand.whyChoose} addLabel="Add reason" />
        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

function CtaSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandCtaAction, {});
  return (
    <Section
      id="sec-cta"
      step="8"
      title="Contact sales / book demo"
      hint="The closing block, plus the link to the manufacturer's own site."
    >
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />
        <Field label="Heading">
          <TextInput name="heading" defaultValue={brand.cta.heading} />
        </Field>
        <Field label="Supporting line">
          <TextArea name="body" rows={2} defaultValue={brand.cta.body} />
        </Field>
        <Field label="Official website URL" hint="Must start with http:// or https://. Leave empty to hide the button.">
          <TextInput
            name="websiteUrl"
            defaultValue={brand.cta.websiteUrl}
            placeholder="https://www.curaprox.com"
          />
        </Field>
        <Field label="Website button label">
          <TextInput name="buttonLabel" defaultValue={brand.cta.buttonLabel} />
        </Field>
        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}
