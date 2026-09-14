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
import { Field, FormMessage, SubmitButton, TextArea, TextInput } from "@/components/admin/Form";
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
    <div className="mt-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      {/* Left — reorderable slide list */}
      <div className="mb-6 lg:mb-0">
        <button
          type="button"
          onClick={() => setSelected(ADD)}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            selected === ADD
              ? "bg-brand-700 text-white"
              : "bg-brand-600 text-white hover:bg-brand-700",
          ].join(" ")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Add banner
        </button>

        {items.length > 0 && (
          <ul className="mt-3 space-y-2">
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
        )}
      </div>

      {/* Right — editor */}
      <div>
        {selected === ADD || !current ? (
          <AddPanel />
        ) : (
          <EditPanel key={current.id} banner={current} index={items.indexOf(current)} />
        )}
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
        "flex items-center gap-2 rounded-xl border bg-surface p-2 transition-colors",
        over ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line",
        active ? "bg-brand-50 ring-1 ring-brand-600" : "hover:border-line-strong",
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
        <span className="relative aspect-[1489/551] w-16 shrink-0 overflow-hidden rounded-md bg-elevated">
          <Image src={banner.image} alt="" fill sizes="64px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">Slide {index + 1}</span>
          <span className="block truncate text-xs text-muted">
            {banner.alt || "No alt text"}
            {banner.href ? " · linked" : ""}
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

/** Editor for the selected slide: live preview, image/alt/link fields, and a separate remove. */
function EditPanel({ banner, index }: { banner: Banner; index: number }) {
  const [state, action] = useActionState<ActionState, FormData>(updateBannerAction, {});

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        Slide {index + 1}
      </h2>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        <div className="relative aspect-[1489/551] bg-elevated">
          <Image src={banner.image} alt={banner.alt} fill sizes="720px" className="object-cover" />
        </div>
      </div>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="id" value={banner.id} />
        <Field label="Replace image" hint="PNG, JPG or WebP · up to 5 MB. Leave empty to keep the current image.">
          <TextInput type="file" name="image" accept="image/*" />
        </Field>
        <Field label="Alt text" hint="Describes the image for screen readers and search.">
          <TextInput name="alt" defaultValue={banner.alt} required />
        </Field>
        <Field
          label="Links to"
          hint="Where clicking the slide goes, e.g. /brands. Empty = no link. Ignored once the slide has its own buttons below."
        >
          <TextInput name="href" defaultValue={banner.href} placeholder="/brands" />
        </Field>
        <OverlayFields banner={banner} />
        <SubmitButton>Save slide</SubmitButton>
        <FormMessage state={state} />
      </form>

      <form action={deleteBannerAction} className="mt-6 border-t border-line pt-4">
        <input type="hidden" name="id" value={banner.id} />
        <SubmitButton variant="danger">Remove this slide</SubmitButton>
      </form>
    </div>
  );
}

function AddPanel() {
  const [state, action] = useActionState<ActionState, FormData>(addBannerAction, {});

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        Add a banner
      </h2>
      <p className="mt-1 text-sm text-muted">
        Upload a wide image (≈2.7:1 fits best). It appears at the top of the storefront right away.
      </p>

      <div className="mt-4 flex aspect-[1489/551] items-center justify-center rounded-xl border border-dashed border-line-strong bg-elevated text-sm text-muted">
        Image preview
      </div>

      <form action={action} className="mt-5 space-y-4">
        <Field label="Image" hint="PNG, JPG or WebP · up to 5 MB.">
          <TextInput type="file" name="image" accept="image/*" required />
        </Field>
        <Field label="Alt text" hint="Describes the image for screen readers and search.">
          <TextInput name="alt" required />
        </Field>
        <Field
          label="Links to"
          hint="Where clicking the slide goes, e.g. /brands. Empty = no link. Ignored once the slide has its own buttons below."
        >
          <TextInput name="href" placeholder="/brands" />
        </Field>
        <OverlayFields />
        <SubmitButton>Add banner</SubmitButton>
        <FormMessage state={state} />
      </form>
    </div>
  );
}

/**
 * The copy laid over the slide. Optional throughout: anything left blank simply isn't drawn, so a
 * slide with all of these empty renders as a plain full-bleed image, exactly as banners behaved
 * before this existed.
 */
function OverlayFields({ banner }: { banner?: Banner }) {
  return (
    <fieldset className="space-y-4 border-t border-line pt-4">
      <legend className="sr-only">Overlay copy</legend>
      <div>
        <h3 className="text-sm font-bold text-fg">Overlay copy</h3>
        <p className="mt-1 text-xs text-muted">
          Text drawn over the image, so it stays sharp and readable on a phone. Leave everything
          blank for an image-only slide. Keep the heading short — it&rsquo;s set very large.
        </p>
      </div>

      <Field label="Eyebrow" hint="Small uppercase line above the heading.">
        <TextInput
          name="eyebrow"
          defaultValue={banner?.eyebrow}
          placeholder="Authorized dental distributor · Philippines"
        />
      </Field>
      <Field label="Heading">
        <TextInput
          name="heading"
          defaultValue={banner?.heading}
          placeholder="Everything your operatory runs on."
        />
      </Field>
      <Field label="Body" hint="One or two sentences.">
        <TextArea name="body" rows={3} defaultValue={banner?.body} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button label" hint="Both fields needed for the button to appear.">
          <TextInput name="ctaLabel" defaultValue={banner?.ctaLabel} placeholder="Shop the catalog" />
        </Field>
        <Field label="Button links to">
          <TextInput name="ctaHref" defaultValue={banner?.ctaHref} placeholder="/shop" />
        </Field>
        <Field label="Second button label" hint="Outlined button beside the first.">
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
    </fieldset>
  );
}
