"use client";

import Image from "next/image";
import { useActionState, useState, type ReactNode } from "react";
import {
  deleteBrandAction,
  saveBrandAboutAction,
  saveBrandCtaAction,
  saveBrandGalleryAction,
  saveBrandHeroAction,
  saveBrandLogoAction,
  saveBrandProductsAction,
  saveBrandReasonsAction,
  saveBrandStatusAction,
  saveBrandVideoAction,
  type ActionState,
} from "@/app/(admin)/admin/actions";
import {
  Field,
  FormMessage,
  RepeatablePairs,
  RepeatableText,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/Form";
import type { Brand, BrandProduct, StoreCategory } from "@/lib/content";
import { BRAND_GROUPS } from "@/lib/constants";

/**
 * The brand page editor. One <form> per section, each bound to its own server action, so a
 * validation failure in one section never discards edits in another.
 */
export function BrandEditor({
  brand,
  categories,
  canDelete,
}: {
  brand: Brand;
  categories: StoreCategory[];
  canDelete: boolean;
}) {
  return (
    <div className="mt-8 space-y-6">
      <StatusSection brand={brand} />
      <HeroSection brand={brand} />
      <LogoSection brand={brand} />
      <AboutSection brand={brand} />
      <VideoSection brand={brand} />
      <GallerySection brand={brand} />
      <ProductsSection brand={brand} categories={categories} />
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

/** Consistent section frame: number, title, blurb, body. */
function Section({
  id,
  step,
  title,
  hint,
  children,
}: {
  id: string;
  step: number | string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-6">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-xs font-bold text-brand-600">{step}</span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
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
        <div className="relative mb-4 aspect-[3/1] overflow-hidden rounded-xl border border-line bg-elevated">
          <Image src={brand.heroImage} alt="" fill sizes="640px" className="object-cover" />
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
      <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-white">
        <Image src={brand.logo} alt={brand.name} fill sizes="640px" className="object-contain p-8" />
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

function ProductsSection({ brand, categories }: { brand: Brand; categories: StoreCategory[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBrandProductsAction, {});
  return (
    <Section
      id="sec-products"
      step="6"
      title="Products"
      hint="The products shown on this brand's page. Add as many as you like — each one has its own image, price and stock."
    >
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />
        {/* Re-key on the saved data so the editor re-seeds from Firestore after each save — without
            this, the uncontrolled fields reset to stale values (React 19 resets forms post-action). */}
        <ProductRows key={JSON.stringify(brand.products)} initial={brand.products} categories={categories} />
        <SubmitButton />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

type Row = BrandProduct & { key: string };

/**
 * Repeatable product editor. Every row posts one value under each `product*` field name (kept
 * aligned by row order) plus one `productImageFile` input, so the server action can zip them.
 */
function ProductRows({
  initial,
  categories,
}: {
  initial: BrandProduct[];
  categories: StoreCategory[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((p) => ({ ...p, key: p.id || crypto.randomUUID() })),
  );

  // Changing the category clears the subcategory (subcategories belong to one category).
  function setCategory(key: string, category: string | undefined) {
    setRows((r) =>
      r.map((row) => (row.key === key ? { ...row, category, subcategory: undefined } : row)),
    );
  }

  function setSubcategory(key: string, subcategory: string | undefined) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, subcategory } : row)));
  }

  function add() {
    setRows((r) => [
      ...r,
      {
        key: crypto.randomUUID(),
        id: crypto.randomUUID(),
        name: "",
        price: 0,
        image: "",
        inStock: true,
        contactSales: false,
      },
    ]);
  }

  function remove(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function toggleStock(key: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, inStock: !row.inStock } : row)));
  }

  function toggleContactSales(key: string) {
    setRows((r) =>
      r.map((row) => (row.key === key ? { ...row, contactSales: !row.contactSales } : row)),
    );
  }

  function removeGalleryImage(key: string, src: string) {
    setRows((r) =>
      r.map((row) =>
        row.key === key
          ? { ...row, gallery: (row.gallery ?? []).filter((g) => g.src !== src) }
          : row,
      ),
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.key} className="rounded-xl border border-line bg-bg p-4">
          {/* Hidden, row-aligned values the action reads by index. */}
          <input type="hidden" name="productId" value={row.id} />
          <input type="hidden" name="productImage" value={row.image} />
          <input type="hidden" name="productInStock" value={row.inStock ? "1" : "0"} />
          <input
            type="hidden"
            name="productContactSales"
            value={row.contactSales ? "1" : "0"}
          />

          <div className="flex gap-4">
            <div className="w-28 shrink-0">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-white">
                {row.image ? (
                  <Image src={row.image} alt="" fill sizes="112px" className="object-contain p-2" />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-[11px] text-muted-light">
                    No image
                  </div>
                )}
              </div>
              <input
                type="file"
                name="productImageFile"
                accept="image/png,image/jpeg,image/webp"
                className="mt-2 block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-elevated file:px-2 file:py-1 file:text-xs file:font-medium file:text-fg"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <TextInput name="productName" defaultValue={row.name} placeholder="Product name" required />
              <div
                className={[
                  "grid grid-cols-2 gap-3",
                  row.contactSales ? "opacity-50" : "",
                ].join(" ")}
              >
                <label className="block">
                  <span className="text-xs font-medium text-muted">Price (₱)</span>
                  <TextInput
                    name="productPrice"
                    type="number"
                    min={0}
                    defaultValue={row.price || ""}
                    placeholder="0"
                    readOnly={row.contactSales}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted">Sale “was” price (optional)</span>
                  <TextInput
                    name="productCompareAt"
                    type="number"
                    min={0}
                    defaultValue={row.compareAtPrice || ""}
                    placeholder="—"
                    readOnly={row.contactSales}
                  />
                </label>
              </div>
              <TextInput
                name="productSummary"
                defaultValue={row.summary ?? ""}
                placeholder="Short one-line summary (optional)"
              />
              {(() => {
                const subs =
                  categories.find((c) => c.slug === row.category)?.subcategories ?? [];
                const catValue = categories.some((c) => c.slug === row.category)
                  ? (row.category as string)
                  : "";
                const subValue = subs.some((s) => s.slug === row.subcategory)
                  ? (row.subcategory as string)
                  : "";
                const selectClass =
                  "mt-1 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-muted">Category</span>
                      <select
                        name="productCategory"
                        value={catValue}
                        onChange={(e) => setCategory(row.key, e.target.value || undefined)}
                        className={selectClass}
                      >
                        <option value="">— No category —</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted">Subcategory</span>
                      <select
                        name="productSubcategory"
                        value={subValue}
                        onChange={(e) => setSubcategory(row.key, e.target.value || undefined)}
                        className={selectClass}
                      >
                        <option value="">
                          {subs.length ? "— None —" : "— No subcategories —"}
                        </option>
                        {subs.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={row.inStock}
                      onChange={() => toggleStock(row.key)}
                    />
                    In stock
                  </label>
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={row.contactSales ?? false}
                      onChange={() => toggleContactSales(row.key)}
                    />
                    Price on request (Contact a sales agent)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-elevated hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible extra content for the product's detail page. Kept in the DOM even when
              collapsed so its fields stay row-aligned with the other `product*` arrays on save. */}
          <details className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-muted hover:text-fg">
              More details — description, photos &amp; highlights (shown on the product page)
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-muted">Description</span>
                <TextArea
                  name="productDescription"
                  defaultValue={(row.description ?? []).join("\n")}
                  rows={4}
                  placeholder="Full description. One paragraph per line."
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">Highlights</span>
                <TextArea
                  name="productHighlights"
                  defaultValue={(row.highlights ?? []).join("\n")}
                  rows={3}
                  placeholder="Key features or specs. One per line."
                />
              </label>

              <div>
                <span className="text-xs font-medium text-muted">Extra photos</span>
                {/* Kept images, posted as JSON; a real form control so it submits with the row. */}
                <input
                  type="hidden"
                  name="productGalleryJson"
                  value={JSON.stringify(row.gallery ?? [])}
                />
                {(row.gallery ?? []).length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {(row.gallery ?? []).map((img) => (
                      <li key={img.src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-elevated">
                        <Image src={img.src} alt="" fill sizes="64px" className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(row.key, img.src)}
                          aria-label="Remove photo"
                          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-xs text-white hover:bg-ink"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  type="file"
                  name={`productGalleryFiles_${row.id}`}
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="mt-2 block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-elevated file:px-2 file:py-1 file:text-xs file:font-medium file:text-fg"
                />
              </div>
            </div>
          </details>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        Add product
      </button>
    </div>
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
