"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBrandProductsAction, } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { FormMessage, SubmitButton, TextArea, TextInput } from "@/components/admin/Form";
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
  const [state, action] = useActionState<ActionState, FormData>(saveBrandProductsAction, {});
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
          onDirty={() => setDirty(true)}
        />
        <FormMessage state={state} />
      </form>
    </Section>
  );
}

type Row = BrandProduct & { key: string };

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
  onDirty,
}: {
  initial: BrandProduct[];
  categories: StoreCategory[];
  dirty: boolean;
  /** Reordering is React state, so it never fires the form's onInput — tell the parent by hand. */
  onDirty: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((p) => ({ ...p, key: p.id || crypto.randomUUID() })),
  );

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
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <ProductRow
          key={row.key}
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
          move={move}
          moveToTop={moveToTop}
          reorder={reorder}
        />
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

      {/* Inside the form on purpose — a submit button outside it stops submitting. */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-6 py-3 backdrop-blur">
        <SubmitButton />
        <span className="text-xs text-muted">
          {rows.length} product{rows.length === 1 ? "" : "s"}
        </span>
        {dirty && <span className="text-xs font-medium text-warn">Unsaved changes</span>}
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
  move,
  moveToTop,
  reorder,
}: {
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

  const subs = categories.find((c) => c.slug === row.category)?.subcategories ?? [];
  const catValue = categories.some((c) => c.slug === row.category) ? (row.category as string) : "";
  const subValue = subs.some((s) => s.slug === row.subcategory) ? (row.subcategory as string) : "";

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      draggable={dragEnabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", row.key);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragEnabled(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        reorder(e.dataTransfer.getData("text/plain"), row.key);
      }}
      className={`group rounded-xl border bg-bg ${
        over ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line"
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
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {name.trim() || (
            <span className="font-normal text-muted-light">
              Untitled — add a name to keep this product
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {row.contactSales ? "On request" : price > 0 ? formatPHP(price) : "—"}
        </span>
        <span
          title={row.inStock ? "In stock" : "Out of stock"}
          className={`h-2 w-2 shrink-0 rounded-full ${
            row.inStock ? "bg-success" : "bg-muted-light"
          }`}
        />
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
              accept="image/*"
              className="mt-2 block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-elevated file:px-2 file:py-1 file:text-xs file:font-medium file:text-fg"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
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

            <div className="flex items-center justify-between">
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
                    <li
                      key={img.src}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-elevated"
                    >
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
                accept="image/*"
                multiple
                className="mt-2 block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-elevated file:px-2 file:py-1 file:text-xs file:font-medium file:text-fg"
              />
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
