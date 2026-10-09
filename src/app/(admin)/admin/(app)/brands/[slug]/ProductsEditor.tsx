"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBrandProductsAction, } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { shrinkImages, uploadBytes, UPLOAD_BUDGET_BYTES } from "@/lib/shrink-images";
import { FormMessage, ImageInput, SubmitButton, TextArea, TextInput } from "@/components/admin/Form";
import type { Brand, BrandProduct, StoreCategory } from "@/lib/content";
import { formatPHP } from "@/lib/format";
import { Section } from "./Section";

export function ProductsEditor({
  brand,
  categories,
}: {
  brand: Brand;
  categories: StoreCategory[];
}) {
  // Photos are shrunk in the browser first: a row's main image plus several extra photos easily
  // tops the 6 MB Server Action body limit, and an over-limit request crashes the page rather than
  // returning an error. Running it inside the action keeps the Save button pending throughout.
  const [state, action] = useActionState<ActionState, FormData>(async (prev, form) => {
    const small = await shrinkImages(form);
    const bytes = uploadBytes(small);
    if (bytes > UPLOAD_BUDGET_BYTES) {
      return {
        error:
          `These photos add up to ${(bytes / 1024 / 1024).toFixed(1)} MB, more than one save can ` +
          `upload. Save a few at a time.`,
      };
    }
    try {
      return await saveBrandProductsAction(prev, small);
    } catch {
      return { error: "Could not save — the upload may be too large. Try saving fewer photos at once." };
    }
  }, {});
  const [dirty, setDirty] = useState(false);

  return (
    <Section
      id="sec-products"
      step="6"
      title="Products"
      hint="The products shown on this brand's page. Add as many as you like — each one has its own image, price and stock."
    >
      <form action={action} onInput={() => setDirty(true)} className="space-y-5">
        <input type="hidden" name="slug" value={brand.slug} />
        {/* Re-key on the saved data so the editor re-seeds from Firestore after each save — without
            this, the uncontrolled fields reset to stale values (React 19 resets forms post-action). */}
        <ProductRows
          key={JSON.stringify(brand.products)}
          initial={brand.products}
          categories={categories}
          dirty={dirty}
          state={state}
          onDirty={() => setDirty(true)}
        />
      </form>
    </Section>
  );
}

type Row = BrandProduct & { key: string };

/** dataTransfer type for an extra-photo drag, so the enclosing product row can ignore it. */
const PHOTO_DRAG = "application/x-product-photo";

/**
 * Repeatable product editor. Every row posts one value under each `product*` field name (kept
 * aligned by row order) plus one `productImageFile` input, so the server action can zip them.
 *
 * Rows collapse to a one-line summary. They use <details> rather than conditional rendering
 * because the action rebuilds `brand.products` from the whole form by index — an unmounted row
 * would silently delete that product. Closed-<details> descendants stay in the DOM and still post.
 *
 * Row order IS the storefront display order: `form.getAll()` returns values in DOM order, so the
 * action saves the products in exactly the sequence shown here. That means reordering this array is
 * the whole reordering feature — no order field, no separate action. It saves with the rest of the
 * form rather than immediately, so a reorder can't clobber unsaved edits via the re-key above.
 */
function ProductRows({
  initial,
  categories,
  dirty,
  state,
  onDirty,
}: {
  initial: BrandProduct[];
  categories: StoreCategory[];
  dirty: boolean;
  state: ActionState;
  /** Reordering is React state, so it never fires the form's onInput — tell the parent by hand. */
  onDirty: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((p) => ({ ...p, key: p.id || crypto.randomUUID() })),
  );
  // Narrows what's SHOWN, never what's posted: filtered-out rows get the `hidden` attribute and
  // stay in the form, because the action rebuilds the product list from every row by index.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const categoryName = (slug?: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  const matches = (row: Row) =>
    !needle ||
    row.name.toLowerCase().includes(needle) ||
    categoryName(row.category).toLowerCase().includes(needle);
  const shown = rows.filter(matches).length;

  function commit(next: Row[]) {
    setRows(next);
    onDirty();
  }

  /** One step up or down — swap with the neighbour. */
  function move(key: string, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.key === key);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  /** Promote to position 1 — the usual request ("show this one first") on a long brand. */
  function moveToTop(key: string) {
    const i = rows.findIndex((r) => r.key === key);
    if (i <= 0) return;
    const next = [...rows];
    const [moved] = next.splice(i, 1);
    next.unshift(moved);
    commit(next);
  }

  /** Drop `dragKey` onto `targetKey` — lift it out and re-insert at the target's index. */
  function reorder(dragKey: string, targetKey: string) {
    if (dragKey === targetKey) return;
    const from = rows.findIndex((r) => r.key === dragKey);
    const to = rows.findIndex((r) => r.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  }

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
    onDirty();
  }

  /** Extra-photo order is the product page's order (after the main image), saved via the JSON. */
  function moveGalleryImage(key: string, from: number, to: number) {
    setRows((r) =>
      r.map((row) => {
        if (row.key !== key) return row;
        const gallery = [...(row.gallery ?? [])];
        if (from === to || from < 0 || to < 0 || from >= gallery.length || to >= gallery.length) {
          return row;
        }
        const [moved] = gallery.splice(from, 1);
        gallery.splice(to, 0, moved);
        return { ...row, gallery };
      }),
    );
    onDirty();
  }

  return (
    <div className="space-y-3">
      {rows.length > 5 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-light"
            >
              <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {/* No `name`, so it never posts; stopPropagation so typing here isn't an "edit". */}
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onInput={(e) => e.stopPropagation()}
              placeholder="Find a product by name or category"
              aria-label="Find a product"
              className="pl-9"
            />
          </div>
          {needle && (
            <span className="text-sm text-muted">
              {shown} of {rows.length} shown
            </span>
          )}
        </div>
      )}

      {rows.map((row, index) => (
        <ProductRow
          key={row.key}
          hidden={!matches(row)}
          categoryName={categoryName(row.category)}
          row={row}
          index={index}
          total={rows.length}
          categories={categories}
          setCategory={setCategory}
          setSubcategory={setSubcategory}
          toggleStock={toggleStock}
          toggleContactSales={toggleContactSales}
          remove={remove}
          removeGalleryImage={removeGalleryImage}
          moveGalleryImage={moveGalleryImage}
          move={move}
          moveToTop={moveToTop}
          reorder={reorder}
        />
      ))}

      {needle && shown === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          No products match “{query.trim()}”.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setQuery("");
          add();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        Add product
      </button>

      {/* Inside the form on purpose — a submit button outside it stops submitting. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-line bg-surface/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
        <SubmitButton>Save products</SubmitButton>
        <span className="text-xs text-muted">
          {rows.length} product{rows.length === 1 ? "" : "s"}
        </span>
        {dirty ? (
          <span className="text-xs font-medium text-warn">Unsaved changes</span>
        ) : (
          <FormMessage state={state} inline />
        )}
      </div>
    </div>
  );
}

const selectClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";

/**
 * A reorder control in a row's <summary>.
 *
 * Both defaults it fights are easy to miss: `type="button"` stops it submitting the surrounding
 * form, and preventDefault stops the click from expanding the <details> it sits inside.
 */
function ReorderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="shrink-0 px-1 text-sm leading-none text-muted hover:text-brand-700 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** One product: a collapsed summary line that expands to the full editor. */
function ProductRow({
  hidden,
  categoryName,
  row,
  index,
  total,
  categories,
  setCategory,
  setSubcategory,
  toggleStock,
  toggleContactSales,
  remove,
  removeGalleryImage,
  moveGalleryImage,
  move,
  moveToTop,
  reorder,
}: {
  /** Filtered out by the search box — still rendered, so it still posts. */
  hidden: boolean;
  categoryName: string;
  row: Row;
  index: number;
  total: number;
  categories: StoreCategory[];
  setCategory: (key: string, category: string | undefined) => void;
  setSubcategory: (key: string, subcategory: string | undefined) => void;
  toggleStock: (key: string) => void;
  toggleContactSales: (key: string) => void;
  remove: (key: string) => void;
  removeGalleryImage: (key: string, src: string) => void;
  moveGalleryImage: (key: string, from: number, to: number) => void;
  move: (key: string, dir: -1 | 1) => void;
  moveToTop: (key: string) => void;
  reorder: (dragKey: string, targetKey: string) => void;
}) {
  // Display-only mirrors for the collapsed summary. The DOM stays the source of truth for what
  // gets posted — these never feed the form, they just keep the one-liner from going stale.
  const [name, setName] = useState(row.name);
  const [price, setPrice] = useState(row.price);
  // A blank name means a just-added row, so start it open. Saved products always have a name.
  const [open, setOpen] = useState(!row.name);
  // Only draggable while the grip is held. BrandRail can mark its whole row draggable because its
  // rows are plain text; a product row is full of inputs, and an always-draggable ancestor turns
  // drag-selecting text inside them into a row drag.
  const [dragEnabled, setDragEnabled] = useState(false);
  const [over, setOver] = useState(false);
  const [photoDrag, setPhotoDrag] = useState<number | null>(null);
  const [photoOver, setPhotoOver] = useState<number | null>(null);
  const gallery = row.gallery ?? [];

  const subs = categories.find((c) => c.slug === row.category)?.subcategories ?? [];
  const catValue = categories.some((c) => c.slug === row.category) ? (row.category as string) : "";
  const subValue = subs.some((s) => s.slug === row.subcategory) ? (row.subcategory as string) : "";

  return (
    <details
      hidden={hidden}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      draggable={dragEnabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", row.key);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragEnabled(false)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(PHOTO_DRAG)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        reorder(e.dataTransfer.getData("text/plain"), row.key);
      }}
      className={`group rounded-xl border bg-surface transition-colors open:border-brand-200 open:shadow-sm ${
        over ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line hover:border-line-strong"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        {/* Reorder cluster. Row order is the storefront order, so this is how a product gets
            promoted. Every control preventDefaults: a click anywhere in a <summary> toggles it. */}
        <span
          onMouseDown={() => setDragEnabled(true)}
          onMouseUp={() => setDragEnabled(false)}
          onClick={(e) => e.preventDefault()}
          title="Drag to reorder"
          aria-hidden="true"
          className="shrink-0 cursor-grab text-muted-light active:cursor-grabbing"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>

        {/* An SVG, not a "⤒" glyph: ↑/↓ are proven in this font (BrandRail uses them), the
            arrow-to-bar character is not and would risk rendering as tofu. */}
        <ReorderButton
          label="Move to first"
          disabled={index === 0}
          onClick={() => moveToTop(row.key)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 4h14M12 20V8m0 0-5 5m5-5 5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ReorderButton>
        <span className="flex shrink-0 flex-col leading-none">
          <ReorderButton label="Move up" disabled={index === 0} onClick={() => move(row.key, -1)}>
            ↑
          </ReorderButton>
          <ReorderButton
            label="Move down"
            disabled={index === total - 1}
            onClick={() => move(row.key, 1)}
          >
            ↓
          </ReorderButton>
        </span>

        <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          {row.image ? (
            <Image src={row.image} alt="" fill sizes="40px" className="object-contain p-1" />
          ) : (
            <span className="m-auto text-[9px] leading-none text-muted-light">No img</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">
            {name.trim() || (
              <span className="font-normal text-muted-light">
                Untitled — add a name to keep this product
              </span>
            )}
          </span>
          {categoryName && (
            <span className="block truncate text-xs text-muted">{categoryName}</span>
          )}
        </span>
        {!row.inStock && (
          <span className="hidden shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted sm:inline">
            Out of stock
          </span>
        )}
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
          {row.contactSales ? (
            <span className="font-medium text-muted">On request</span>
          ) : price > 0 ? (
            formatPHP(price)
          ) : (
            <span className="text-muted-light">No price</span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-muted-light transition-transform group-open:rotate-180"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="border-t border-line p-4">
        {/* Hidden, row-aligned values the action reads by index. */}
        <input type="hidden" name="productId" value={row.id} />
        <input type="hidden" name="productImage" value={row.image} />
        <input type="hidden" name="productInStock" value={row.inStock ? "1" : "0"} />
        <input type="hidden" name="productContactSales" value={row.contactSales ? "1" : "0"} />

        <div className="space-y-4">
          {/* One `productImageFile` per row, posted even when empty, so files stay row-aligned. */}
          <ImageInput
            name="productImageFile"
            shape="square"
            current={row.image}
            hint="Main photo · shown on cards and the product page"
          />

          <div className="min-w-0 space-y-3">
            {/* No `required`: the action treats a blank name as "row removed", and a required
                control inside a collapsed row blocks submit with an unfocusable-control error. */}
            <TextInput
              name="productName"
              defaultValue={row.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
            />
            <div
              className={["grid grid-cols-2 gap-3", row.contactSales ? "opacity-50" : ""].join(" ")}
            >
              <label className="block">
                <span className="text-xs font-medium text-muted">Price (₱)</span>
                <TextInput
                  name="productPrice"
                  type="number"
                  min={0}
                  defaultValue={row.price || ""}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  onInvalid={() => setOpen(true)}
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
                  onInvalid={() => setOpen(true)}
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
                  <option value="">{subs.length ? "— None —" : "— No subcategories —"}</option>
                  {subs.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" checked={row.inStock} onChange={() => toggleStock(row.key)} />
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
        <details className="mt-4 rounded-lg border border-line bg-bg/60 px-3 py-2">
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
                value={JSON.stringify(gallery)}
              />
              {gallery.length > 0 && (
                <>
                  <p className="mt-1 text-xs text-muted-light">
                    Shown on the product page in this order, after the main image. Drag a photo or
                    use the arrows to reorder. New photos are added at the end.
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {gallery.map((img, i) => (
                      <li
                        key={img.src}
                        draggable
                        // Stop each event at the photo: the product row is a drop target too, and
                        // its handlers would otherwise read this as a product reorder.
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData(PHOTO_DRAG, String(i));
                          e.dataTransfer.effectAllowed = "move";
                          setPhotoDrag(i);
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          setPhotoDrag(null);
                          setPhotoOver(null);
                        }}
                        onDragOver={(e) => {
                          if (photoDrag === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setPhotoOver(i);
                        }}
                        onDragLeave={() => setPhotoOver((o) => (o === i ? null : o))}
                        onDrop={(e) => {
                          if (photoDrag === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          moveGalleryImage(row.key, photoDrag, i);
                          setPhotoDrag(null);
                          setPhotoOver(null);
                        }}
                        className={`flex cursor-grab flex-col items-center gap-1 active:cursor-grabbing ${
                          photoDrag === i ? "opacity-40" : ""
                        }`}
                      >
                        <span
                          className={`relative h-16 w-16 overflow-hidden rounded-lg border bg-elevated ${
                            photoOver === i && photoDrag !== i
                              ? "border-brand-500 ring-2 ring-brand-500/30"
                              : "border-line"
                          }`}
                        >
                          <Image
                            src={img.src}
                            alt=""
                            fill
                            sizes="64px"
                            draggable={false}
                            className="object-cover"
                          />
                          <span className="absolute bottom-0.5 left-0.5 rounded-full bg-ink/60 px-1.5 text-[10px] font-semibold leading-4 text-white">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(row.key, img.src)}
                            aria-label="Remove photo"
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-xs text-white hover:bg-ink"
                          >
                            ×
                          </button>
                        </span>
                        <span className="flex">
                          <ReorderButton
                            label="Move photo earlier"
                            disabled={i === 0}
                            onClick={() => moveGalleryImage(row.key, i, i - 1)}
                          >
                            ←
                          </ReorderButton>
                          <ReorderButton
                            label="Move photo later"
                            disabled={i === gallery.length - 1}
                            onClick={() => moveGalleryImage(row.key, i, i + 1)}
                          >
                            →
                          </ReorderButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-2">
                <ImageInput
                  name={`productGalleryFiles_${row.id}`}
                  multiple
                  shape="square"
                  hint="Add more photos for the product page"
                />
              </div>
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
