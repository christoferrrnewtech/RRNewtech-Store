"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBrandProductsAction, } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { FormMessage, SubmitButton, TextArea, TextInput } from "@/components/admin/Form";
import type { Brand, BrandProduct, StoreCategory } from "@/lib/content";
import { isMeasured } from "@/lib/jrs-packaging";
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
 */
function ProductRows({
  initial,
  categories,
  dirty,
}: {
  initial: BrandProduct[];
  categories: StoreCategory[];
  dirty: boolean;
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
    <div className="space-y-3">
      {rows.map((row) => (
        <ProductRow
          key={row.key}
          row={row}
          categories={categories}
          setCategory={setCategory}
          setSubcategory={setSubcategory}
          toggleStock={toggleStock}
          toggleContactSales={toggleContactSales}
          remove={remove}
          removeGalleryImage={removeGalleryImage}
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
 * One parcel dimension. Uncontrolled like every other field in this row — `onChange` only mirrors
 * the value out so the status dot can react while the admin types.
 *
 * `step="any"` because JRS's own boxes are measured to the hundredth of a centimetre, and a control
 * that silently rejects 4.5 would be worse than one that accepts a wrong number.
 */
function DimensionInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <TextInput
        name={name}
        type="number"
        min={0}
        step="any"
        defaultValue={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || undefined)}
        placeholder="—"
      />
    </label>
  );
}

/** One product: a collapsed summary line that expands to the full editor. */
function ProductRow({
  row,
  categories,
  setCategory,
  setSubcategory,
  toggleStock,
  toggleContactSales,
  remove,
  removeGalleryImage,
}: {
  row: Row;
  categories: StoreCategory[];
  setCategory: (key: string, category: string | undefined) => void;
  setSubcategory: (key: string, subcategory: string | undefined) => void;
  toggleStock: (key: string) => void;
  toggleContactSales: (key: string) => void;
  remove: (key: string) => void;
  removeGalleryImage: (key: string, src: string) => void;
}) {
  // Display-only mirrors for the collapsed summary. The DOM stays the source of truth for what
  // gets posted — these never feed the form, they just keep the one-liner from going stale.
  const [name, setName] = useState(row.name);
  const [price, setPrice] = useState(row.price);
  // Same idea for the four parcel dimensions, which drive the status dot: without a mirror the dot
  // would stay amber until the page reloads, so the admin couldn't tell whether it had worked.
  const [dims, setDims] = useState({
    length: row.length,
    width: row.width,
    height: row.height,
    weight: row.weight,
  });
  const measured = isMeasured(dims);
  // A blank name means a just-added row, so start it open. Saved products always have a name.
  const [open, setOpen] = useState(!row.name);

  const subs = categories.find((c) => c.slug === row.category)?.subcategories ?? [];
  const catValue = categories.some((c) => c.slug === row.category) ? (row.category as string) : "";
  const subValue = subs.some((s) => s.slug === row.subcategory) ? (row.subcategory as string) : "";

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-xl border border-line bg-bg"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
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
        {/* Three states, in precedence order. Out of stock wins — nothing else matters if it
            can't be sold. Amber is the new one: the product ships, but with no dimensions we
            can't rate it, so its share of every order it lands in is guesswork. */}
        <span
          title={
            !row.inStock
              ? "Out of stock"
              : !measured
                ? "Missing dimensions — shipping can't be rated for this product"
                : "In stock"
          }
          className={`h-2 w-2 shrink-0 rounded-full ${
            !row.inStock ? "bg-muted-light" : !measured ? "bg-warn" : "bg-success"
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
              accept="image/png,image/jpeg,image/webp"
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

            {/* Parcel size, for the JRS rate at checkout. Optional, but ALL FOUR or none — a
                product missing any one of them is invisible to the box-fitting aggregate and the
                order falls back to declaring a 1 Pounder. Measure the item as it ships, boxed. */}
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DimensionInput
                  label="Length (cm)"
                  name="productLength"
                  value={row.length}
                  onChange={(length) => setDims((d) => ({ ...d, length }))}
                />
                <DimensionInput
                  label="Width (cm)"
                  name="productWidth"
                  value={row.width}
                  onChange={(width) => setDims((d) => ({ ...d, width }))}
                />
                <DimensionInput
                  label="Height (cm)"
                  name="productHeight"
                  value={row.height}
                  onChange={(height) => setDims((d) => ({ ...d, height }))}
                />
                <DimensionInput
                  label="Weight (g)"
                  name="productWeight"
                  value={row.weight}
                  onChange={(weight) => setDims((d) => ({ ...d, weight }))}
                />
              </div>
              {!measured && (
                <p className="mt-1.5 text-xs text-warn">
                  Fill in all four to have JRS rate this product at checkout. Without them we
                  declare a 1 Pounder box for the whole order and JRS bills the overflow as an
                  excess charge.
                </p>
              )}
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
                accept="image/png,image/jpeg,image/webp"
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
