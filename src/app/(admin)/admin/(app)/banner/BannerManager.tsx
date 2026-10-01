"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  addBannerAction,
  deleteBannerAction,
  reorderBannersAction,
  updateBannerAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import {
  Field,
  ImageInput,
  SaveBar,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/Form";
import { FormSection, PageHeader, Panel } from "@/components/admin/Panel";
import type { Banner } from "@/lib/content";

const ADD = "add" as const;
type Selection = string | typeof ADD;

export function BannerManager({ banners }: { banners: Banner[] }) {
  // Local order for instant drag/arrow feedback; reconciled to the server's list below.
  const [items, setItems] = useState<Banner[]>(banners);
  const [selected, setSelected] = useState<Selection>(banners[0]?.id ?? ADD);
  const [, startTransition] = useTransition();

  // Adjust state during render when the server sends a new `banners` (after add/delete/reorder) —
  // React's recommended pattern for syncing state to a changed prop, avoiding a setState effect.
  const [prevBanners, setPrevBanners] = useState(banners);
  if (banners !== prevBanners) {
    setPrevBanners(banners);
    setItems(banners);
    if (banners.length > prevBanners.length) {
      // A slide was added → jump to the newest so the user can keep editing it.
      setSelected(banners[banners.length - 1].id);
    } else if (selected !== ADD && !banners.some((b) => b.id === selected)) {
      // The selected slide vanished (deleted) → fall back sensibly.
      setSelected(banners[0]?.id ?? ADD);
    }
  }

  function commitOrder(next: Banner[]) {
    setItems(next); // optimistic
    startTransition(() => reorderBannersAction(next.map((b) => b.id)));
  }

  function move(id: string, dir: -1 | 1) {
    const i = items.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  }

  function drop(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const from = items.findIndex((b) => b.id === dragId);
    const to = items.findIndex((b) => b.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOrder(next);
  }

  const current = items.find((b) => b.id === selected);

  return (
    <div>
      <PageHeader
        title="Home banner"
        description={
          items.length > 1
            ? `${items.length} slides rotate as a carousel at the top of the storefront. Changes appear immediately.`
            : "The image at the top of the storefront. Add a second slide and they rotate as a carousel."
        }
        actions={
          <button
            type="button"
            onClick={() => setSelected(ADD)}
            disabled={selected === ADD}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Add slide
          </button>
        }
      />

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Left — reorderable slide list */}
      <div className="self-start rounded-2xl border border-line bg-surface lg:sticky lg:top-6">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Slides</h2>
          <p className="text-xs text-muted">Drag to change the order they play in.</p>
        </div>
        {items.length > 0 ? (
          <ul className="space-y-1 p-2">
            {items.map((b, i) => (
              <SlideRow
                key={b.id}
                banner={b}
                index={i}
                total={items.length}
                active={selected === b.id}
                onSelect={() => setSelected(b.id)}
                onMove={move}
                onDrop={drop}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">No slides yet.</p>
        )}
      </div>

      {/* Right — editor */}
      <div className="min-w-0">
        {selected === ADD || !current ? (
          <AddPanel />
        ) : (
          <EditPanel key={current.id} banner={current} index={items.indexOf(current)} />
        )}
      </div>
    </div>
    </div>
  );
}

function SlideRow({
  banner,
  index,
  total,
  active,
  onSelect,
  onMove,
  onDrop,
}: {
  banner: Banner;
  index: number;
  total: number;
  active: boolean;
  onSelect: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrop: (dragId: string, targetId: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", banner.id)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer.getData("text/plain"), banner.id);
      }}
      className={[
        "group flex items-center gap-2 rounded-lg p-2 transition-colors",
        over ? "bg-brand-50 ring-2 ring-brand-500/40" : "",
        active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-elevated/60",
      ].join(" ")}
    >
      <span className="cursor-grab text-muted-light active:cursor-grabbing" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="relative aspect-[1489/551] w-20 shrink-0 overflow-hidden rounded-md border border-line bg-elevated">
          <Image src={banner.image} alt="" fill sizes="80px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span
            className={`block text-sm font-semibold ${active ? "text-brand-700" : "text-fg"}`}
          >
            Slide {index + 1}
          </span>
          <span className="block truncate text-xs text-muted">
            {banner.heading || banner.alt || "No alt text"}
          </span>
        </span>
      </button>

      <span className="flex flex-col">
        <button
          type="button"
          onClick={() => onMove(banner.id, -1)}
          disabled={index === 0}
          aria-label="Move up"
          className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(banner.id, 1)}
          disabled={index === total - 1}
          aria-label="Move down"
          className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
        >
          ↓
        </button>
      </span>
    </li>
  );
}

/** Editor for the selected slide: preview + image, basics, overlay copy, and a separate remove. */
function EditPanel({ banner, index }: { banner: Banner; index: number }) {
  const [state, action] = useActionState<ActionState, FormData>(updateBannerAction, {});

  return (
    <div className="space-y-6">
      <Panel title={`Slide ${index + 1}`} description="Changes appear on the storefront as soon as you save.">
        <form action={action} className="space-y-6">
          <input type="hidden" name="id" value={banner.id} />
          <FormSection title="Image">
            <ImageInput
              name="image"
              current={banner.image}
              stacked
              aspect="aspect-[1489/551]"
              hint="About 2.7:1 fits best · PNG, JPG or WebP · up to 5 MB"
            />
          </FormSection>
          <BasicsFields banner={banner} />
          <OverlayFields banner={banner} />
          <SaveBar state={state} label="Save slide" />
        </form>
      </Panel>

      <Panel tone="danger" title="Remove this slide" description="It disappears from the storefront straight away.">
        <form
          action={deleteBannerAction}
          onSubmit={(e) => {
            if (!confirm(`Remove slide ${index + 1}? This can't be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={banner.id} />
          <SubmitButton variant="danger" size="sm" pendingLabel="Removing…">
            Remove slide {index + 1}
          </SubmitButton>
        </form>
      </Panel>
    </div>
  );
}

function AddPanel() {
  const [state, action] = useActionState<ActionState, FormData>(addBannerAction, {});

  return (
    <Panel title="Add a slide" description="It appears at the top of the storefront right away.">
      <form action={action} className="space-y-6">
        <FormSection title="Image">
          <ImageInput
            name="image"
            required
            stacked
            aspect="aspect-[1489/551]"
            hint="About 2.7:1 fits best · PNG, JPG or WebP · up to 5 MB"
          />
        </FormSection>
        <BasicsFields />
        <OverlayFields />
        <SaveBar state={state} label="Add slide" pendingLabel="Adding…" />
      </form>
    </Panel>
  );
}

function BasicsFields({ banner }: { banner?: Banner }) {
  return (
    <FormSection title="Basics">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Alt text" hint="Describes the image for screen readers and search.">
          <TextInput name="alt" defaultValue={banner?.alt} required />
        </Field>
        <Field label="Links to" hint="Where a click on the slide goes. Ignored once it has buttons.">
          <TextInput name="href" defaultValue={banner?.href} placeholder="/brands" />
        </Field>
      </div>
    </FormSection>
  );
}

/**
 * The copy laid over the slide. Optional throughout: anything left blank simply isn't drawn, so a
 * slide with all of these empty renders as a plain full-bleed image, exactly as banners behaved
 * before this existed.
 */
function OverlayFields({ banner }: { banner?: Banner }) {
  return (
    <>
      <FormSection
        title="Overlay copy"
        description="Text drawn over the image, so it stays sharp on a phone. Leave it all blank for an image-only slide."
      >
        <Field label="Eyebrow" hint="Small uppercase line above the heading.">
          <TextInput
            name="eyebrow"
            defaultValue={banner?.eyebrow}
            placeholder="Authorized dental distributor · Philippines"
          />
        </Field>
        <Field label="Heading" hint="Keep it short — it's set very large.">
          <TextInput
            name="heading"
            defaultValue={banner?.heading}
            placeholder="Everything your operatory runs on."
          />
        </Field>
        <Field label="Body" hint="One or two sentences.">
          <TextArea name="body" rows={3} defaultValue={banner?.body} />
        </Field>
      </FormSection>

      <FormSection
        title="Buttons"
        description="Each button needs both a label and a link to appear. The second one is outlined, beside the main one."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Main button label">
            <TextInput name="ctaLabel" defaultValue={banner?.ctaLabel} placeholder="Shop the catalog" />
          </Field>
          <Field label="Main button links to">
            <TextInput name="ctaHref" defaultValue={banner?.ctaHref} placeholder="/shop" />
          </Field>
          <Field label="Second button label">
            <TextInput
              name="ctaAltLabel"
              defaultValue={banner?.ctaAltLabel}
              placeholder="Request a quote"
            />
          </Field>
          <Field label="Second button links to">
            <TextInput name="ctaAltHref" defaultValue={banner?.ctaAltHref} placeholder="/contact" />
          </Field>
        </div>
      </FormSection>
    </>
  );
}
