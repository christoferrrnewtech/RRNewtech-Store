"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
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
  ImageInput,
  RepeatablePairs,
  RepeatableText,
  SaveBar,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";
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
    <div className="mt-6 space-y-6">
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
        <Panel
          tone="danger"
          title="Delete this brand"
          description={`Removes ${brand.name} from the storefront and from every marketing account’s access. Uploaded images stay on disk. This can’t be undone.`}
        >
          <form
            action={deleteBrandAction}
            onSubmit={(e) => {
              if (!confirm(`Delete ${brand.name}? This can't be undone.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="slug" value={brand.slug} />
            <SubmitButton variant="danger" pendingLabel="Deleting…">
              Delete {brand.name}
            </SubmitButton>
          </form>
        </Panel>
      )}
    </div>
  );
}

function StatusSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandStatusAction, {});
  return (
    <Section
      id="sec-visibility"
      title="Visibility"
      hint="Drafts are hidden everywhere on the storefront, and their page returns 404."
    >
      <form action={action}>
        <input type="hidden" name="slug" value={brand.slug} />
        <div className="grid gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
          <Field label="Status">
            <Select name="status" defaultValue={brand.status}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published (live)</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg/60 p-4 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/50">
            <input
              type="checkbox"
              name="featuredOnHome"
              value="1"
              defaultChecked={brand.featuredOnHome !== false}
              className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/20"
            />
            <span>
              <span className="block text-sm font-semibold text-fg">
                Feature this brand on the homepage
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                Gives it its own product shelf in the homepage “By Brand” view, once it&apos;s
                published and has a product. Its brand page stays live either way.
              </span>
            </span>
          </label>
        </div>
        <SaveBar state={state} label="Update visibility" />
      </form>
    </Section>
  );
}

function HeroSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandHeroAction, {});
  return (
    <Section id="sec-hero" step="1" title="Hero banner" hint="Wide image across the top of the brand page. Optional.">
      <form action={action}>
        <input type="hidden" name="slug" value={brand.slug} />
        <ImageInput
          name="heroImage"
          current={brand.heroImage}
          removeName="remove"
          removeLabel="Remove the current hero"
          hint="1489 × 551 (2.7:1) fits the band exactly · up to 5 MB"
        />
        <SaveBar state={state} />
      </form>
    </Section>
  );
}

function LogoSection({ brand }: { brand: Brand }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandLogoAction, {});
  return (
    <Section id="sec-logo" step="2" title="Brand logo" hint="Shown on the brand card, the brand page and product cards.">
      <form action={action}>
        <input type="hidden" name="slug" value={brand.slug} />
        <ImageInput
          name="logo"
          shape="logo"
          current={brand.logo}
          required
          hint="PNG, JPG or WebP · up to 5 MB"
        />
        <SaveBar state={state} label="Upload logo" pendingLabel="Uploading…" />
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
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Brand name">
            <TextInput name="name" defaultValue={brand.name} required />
          </Field>
          <Field label="Group" hint="The tag on the brand card, and the Shop-by-Brand filter.">
            <Select name="group" defaultValue={brand.group}>
              {BRAND_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tagline" hint="One line on the brand card and hero — the reason a clinic cares.">
          <TextInput name="tagline" defaultValue={brand.tagline} />
        </Field>
        <Field label="Short blurb" hint="1–2 sentences under the hero. Also used as the page description in search results.">
          <TextArea name="blurb" rows={2} defaultValue={brand.blurb} />
        </Field>
        <Field label="Body paragraphs" group>
          <RepeatableText
            name="about"
            initial={brand.about}
            addLabel="Add paragraph"
            placeholder="Tell the story of this brand…"
          />
        </Field>
        <SaveBar state={state} />
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
        <SaveBar state={state} />
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
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {brand.gallery.map((img) => (
              <GalleryItem key={img.src} src={img.src} caption={img.caption ?? ""} />
            ))}
          </ul>
        )}

        <Field label="Add images" hint="Select one or more. PNG, JPG or WebP · up to 5 MB each." group>
          <ImageInput name="newImages" multiple hint="New images are added after the ones above." />
        </Field>

        <SaveBar state={state} label="Save gallery" />
      </form>
    </Section>
  );
}

/**
 * One saved gallery image: thumbnail, caption, and a remove toggle.
 *
 * Removal posts a BLANK `gallerySrc`, which `saveBrandGalleryAction` drops — the row still posts so
 * the src and caption lists stay aligned by index. Nothing is removed until the gallery is saved.
 */
function GalleryItem({ src, caption }: { src: string; caption: string }) {
  const [removed, setRemoved] = useState(false);
  return (
    <li
      className={`overflow-hidden rounded-xl border bg-bg/60 transition-opacity ${
        removed ? "border-danger/40 opacity-60" : "border-line"
      }`}
    >
      <div className="relative aspect-[16/10] bg-elevated">
        <Image src={src} alt="" fill sizes="(min-width: 1280px) 260px, 45vw" className="object-cover" />
        {removed && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/70 text-sm font-semibold text-danger">
            Removed on save
          </span>
        )}
      </div>
      <input type="hidden" name="gallerySrc" value={removed ? "" : src} />
      <div className="flex items-center gap-2 p-2.5">
        <TextInput
          name="galleryCaption"
          defaultValue={caption}
          placeholder="Caption (optional)"
          aria-label="Caption"
          className="flex-1 py-2"
        />
        <button
          type="button"
          onClick={() => setRemoved((r) => !r)}
          className={`shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold ${
            removed ? "text-fg hover:bg-elevated" : "text-muted hover:bg-danger/5 hover:text-danger"
          }`}
        >
          {removed ? "Undo" : "Remove"}
        </button>
      </div>
    </li>
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-bg/60 p-4">
        <div className="flex items-center gap-3">
          {/* A peek at what's there, so the card says more than a number. */}
          <div className="flex -space-x-2">
            {brand.products
              .filter((p) => p.image)
              .slice(0, 4)
              .map((p) => (
                <span
                  key={p.id}
                  className="relative h-10 w-10 overflow-hidden rounded-lg border-2 border-surface bg-white"
                >
                  <Image src={p.image} alt="" fill sizes="40px" className="object-contain p-0.5" />
                </span>
              ))}
          </div>
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg">
              {count} product{count === 1 ? "" : "s"}
            </span>{" "}
            on this brand&apos;s page
          </p>
        </div>
        <Link
          href={`/admin/brands/${brand.slug}/products`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Manage products →
        </Link>
      </div>
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
        <SaveBar state={state} />
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
        <SaveBar state={state} />
      </form>
    </Section>
  );
}
