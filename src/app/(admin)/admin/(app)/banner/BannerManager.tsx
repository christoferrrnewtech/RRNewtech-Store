"use client";

import Image from "next/image";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  addBannerAction,
  deleteBannerAction,
  reorderBannersAction,
  updateBannerAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import {
  ColorInput,
  Field,
  ImageInput,
  SaveBar,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/Form";
import { FormSection, PageHeader, Panel } from "@/components/admin/Panel";
import { HeroSlide } from "@/components/home/HeroSlide";
import {
  BANNER_STYLE_DEFAULTS,
  TEXT_SIZE_LABELS,
  TEXT_SIZES,
  bannerStyleFromForm,
  type ButtonColors,
  type TextSize,
} from "@/lib/banner-style";
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
  const [draft, onFormChange] = useDraftBanner(banner);

  return (
    <div className="space-y-6">
      <Panel title={`Slide ${index + 1}`} description="Changes appear on the storefront as soon as you save.">
        <form action={action} onChange={onFormChange} className="space-y-6">
          <input type="hidden" name="id" value={banner.id} />
          <SlidePreview banner={draft} />
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

const NEW_BANNER: Banner = {
  id: "new",
  image: "",
  alt: "",
  href: "",
  order: 0,
  style: BANNER_STYLE_DEFAULTS,
};

function AddPanel() {
  const [state, action] = useActionState<ActionState, FormData>(addBannerAction, {});
  const [draft, onFormChange] = useDraftBanner(NEW_BANNER);

  return (
    <Panel title="Add a slide" description="It appears at the top of the storefront right away.">
      <form action={action} onChange={onFormChange} className="space-y-6">
        <SlidePreview banner={draft} />
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
 * The slide as the editor currently has it, unsaved changes included. Re-read from the form on
 * every edit rather than mirroring each field in state, so the inputs stay uncontrolled.
 */
function useDraftBanner(base: Banner) {
  const [draft, setDraft] = useState(base);
  // The picked file's blob URL, reused while the same file stays picked and revoked when it changes.
  const picked = useRef<{ file: File; url: string } | null>(null);

  useEffect(
    () => () => {
      if (picked.current) URL.revokeObjectURL(picked.current.url);
    },
    [],
  );

  function onFormChange(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    // Wait a frame: a hex typed into a ColorInput reaches its swatch (the field that posts) through
    // state, which hasn't rendered yet when this event fires.
    requestAnimationFrame(() => {
      const data = new FormData(form);
      const str = (key: string) => {
        const v = data.get(key);
        return typeof v === "string" && v.trim() ? v.trim() : undefined;
      };

      let image = base.image;
      const file = data.get("image");
      if (file instanceof File && file.size > 0) {
        if (picked.current?.file !== file) {
          if (picked.current) URL.revokeObjectURL(picked.current.url);
          picked.current = { file, url: URL.createObjectURL(file) };
        }
        image = picked.current.url;
      }

      setDraft({
        ...base,
        image,
        eyebrow: str("eyebrow"),
        heading: str("heading"),
        body: str("body"),
        ctaLabel: str("ctaLabel"),
        ctaHref: str("ctaHref"),
        ctaAltLabel: str("ctaAltLabel"),
        ctaAltHref: str("ctaAltHref"),
        style: bannerStyleFromForm(data),
      });
    });
  }

  return [draft, onFormChange] as const;
}

/** Desktop width the preview is laid out at, then scaled down to fit the panel. */
const PREVIEW_WIDTH = 1440;

/**
 * The real storefront slide, drawn at desktop width and shrunk to fit. Clicks are swallowed so a
 * stray click on a button doesn't navigate away from unsaved edits — but hover still works, which
 * is how the buttons' highlight color gets checked.
 */
function SlidePreview({ banner }: { banner: Banner }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / PREVIEW_WIDTH),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Preview</p>
      <p className="mt-1 text-sm text-muted">
        Updates as you edit. Hover the buttons to see their highlight color.
      </p>
      <div
        ref={frame}
        onClickCapture={(e) => e.preventDefault()}
        className="mt-3 overflow-hidden rounded-xl border border-line"
      >
        <div style={{ width: PREVIEW_WIDTH, zoom: scale }}>
          <HeroSlide banner={banner} headingLevel="h2" />
        </div>
      </div>
    </div>
  );
}

function SizeSelect({ name, defaultValue }: { name: string; defaultValue: TextSize }) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      {TEXT_SIZES.map((size) => (
        <option key={size} value={size}>
          {TEXT_SIZE_LABELS[size]}
        </option>
      ))}
    </Select>
  );
}

/** Text, button, and highlight colors for one hero button. */
function ButtonColorFields({
  prefix,
  label,
  colors,
}: {
  /** Form field prefix: "cta" or "ctaAlt". */
  prefix: string;
  label: string;
  colors: ButtonColors;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label="Text color" group>
        <ColorInput name={`${prefix}Text`} defaultValue={colors.text} label={`${label} text color`} />
      </Field>
      <Field label="Button color" group>
        <ColorInput
          name={`${prefix}Bg`}
          defaultValue={colors.background}
          label={`${label} button color`}
        />
      </Field>
      <Field label="Highlight color" tip="The button color while the mouse is over it." group>
        <ColorInput
          name={`${prefix}Hover`}
          defaultValue={colors.hover}
          label={`${label} highlight color`}
        />
      </Field>
    </div>
  );
}

/**
 * The copy laid over the slide, with its colors and sizes. The copy is optional throughout:
 * anything left blank simply isn't drawn, so a slide with all of it empty renders as a plain
 * full-bleed image, exactly as banners behaved before this existed.
 */
function OverlayFields({ banner }: { banner?: Banner }) {
  const style = banner?.style ?? BANNER_STYLE_DEFAULTS;

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
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Eyebrow color" group>
            <ColorInput name="eyebrowColor" defaultValue={style.eyebrowColor} label="Eyebrow color" />
          </Field>
        </div>

        <Field label="Heading" hint="Keep it short — it's set very large.">
          <TextInput
            name="heading"
            defaultValue={banner?.heading}
            placeholder="Everything your operatory runs on."
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Heading color" group>
            <ColorInput name="headingColor" defaultValue={style.headingColor} label="Heading color" />
          </Field>
          <Field label="Heading size">
            <SizeSelect name="headingSize" defaultValue={style.headingSize} />
          </Field>
        </div>

        <Field label="Body" hint="One or two sentences.">
          <TextArea name="body" rows={3} defaultValue={banner?.body} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Body color" group>
            <ColorInput name="bodyColor" defaultValue={style.bodyColor} label="Body color" />
          </Field>
          <Field label="Body size">
            <SizeSelect name="bodySize" defaultValue={style.bodySize} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Main button"
        description="Needs both a label and a link to appear."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Label">
            <TextInput name="ctaLabel" defaultValue={banner?.ctaLabel} placeholder="Shop the catalog" />
          </Field>
          <Field label="Links to">
            <TextInput name="ctaHref" defaultValue={banner?.ctaHref} placeholder="/shop" />
          </Field>
        </div>
        <ButtonColorFields prefix="cta" label="Main button" colors={style.cta} />
      </FormSection>

      <FormSection
        title="Second button"
        description="Sits beside the main one. Needs both a label and a link to appear."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Label">
            <TextInput
              name="ctaAltLabel"
              defaultValue={banner?.ctaAltLabel}
              placeholder="Request a quote"
            />
          </Field>
          <Field label="Links to">
            <TextInput name="ctaAltHref" defaultValue={banner?.ctaAltHref} placeholder="/contact" />
          </Field>
        </div>
        <ButtonColorFields prefix="ctaAlt" label="Second button" colors={style.ctaAlt} />
      </FormSection>
    </>
  );
}
