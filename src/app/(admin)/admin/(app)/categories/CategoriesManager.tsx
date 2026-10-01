"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  createSubcategoryAction,
  renameSubcategoryAction,
  deleteSubcategoryAction,
  reorderSubcategoriesAction,
  setCategoryImageAction,
} from "@/app/(admin)/admin/actions";
import Image from "next/image";
import type { ActionState } from "@/lib/form-data";
import { FormMessage, ImageInput, SubmitButton, TextInput } from "@/components/admin/Form";
import type { StoreCategory, Subcategory } from "@/lib/content";

export function CategoriesManager({ categories }: { categories: StoreCategory[] }) {
  const [items, setItems] = useState(categories);
  const [selected, setSelected] = useState<string | null>(categories[0]?.slug ?? null);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  // Reconcile local order/selection when the server sends a new list (create / delete / reorder).
  const [prev, setPrev] = useState(categories);
  if (categories !== prev) {
    setPrev(categories);
    setItems(categories);
    if (selected && !categories.some((c) => c.slug === selected)) {
      setSelected(categories[0]?.slug ?? null);
    } else if (!selected && categories.length > 0) {
      setSelected(categories[0].slug);
    }
  }

  function moveCategory(slug: string, dir: -1 | 1) {
    const i = items.findIndex((c) => c.slug === slug);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    startTransition(() => reorderCategoriesAction(next.map((c) => c.slug)));
  }

  const filtered = search
    ? items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : items;
  const current = items.find((c) => c.slug === selected) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      {/* Left — categories */}
      <div className="rounded-2xl border border-line bg-surface">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-fg">All categories</h2>
            <span className="text-xs text-muted">{items.length} total</span>
          </div>
          <TextInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a category…"
            aria-label="Find a category"
          />
          <NewNameForm
            key={`cat-${items.length}`}
            action={createCategoryAction}
            placeholder="New category name"
            addLabel="Add"
          />
        </div>

        <ul className="space-y-0.5 p-2">
          {filtered.map((c) => (
            <CategoryRow
              key={c.slug}
              category={c}
              index={items.indexOf(c)}
              total={items.length}
              active={c.slug === selected}
              onSelect={() => setSelected(c.slug)}
              onMove={moveCategory}
            />
          ))}
          {filtered.length === 0 && (
            <li className="py-6 text-center text-sm text-muted">No categories match.</li>
          )}
        </ul>
      </div>

      {/* Right — the selected category. Sticky, so it stays in view down a long list. */}
      <div className="self-start rounded-2xl border border-line bg-surface lg:sticky lg:top-6">
        {current ? (
          <SubcategoryPanel key={current.slug} category={current} />
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Select a category to manage its subcategories.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  index,
  total,
  active,
  onSelect,
  onMove,
}: {
  category: StoreCategory;
  index: number;
  total: number;
  active: boolean;
  onSelect: () => void;
  onMove: (slug: string, dir: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Close the editor once the name actually changes (rename succeeded + revalidated).
  const [prevName, setPrevName] = useState(category.name);
  if (category.name !== prevName) {
    setPrevName(category.name);
    setEditing(false);
  }

  return (
    <li
      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
        active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-elevated/60"
      }`}
    >
      {editing ? (
        <RenameForm
          initial={category.name}
          hidden={[{ name: "slug", value: category.slug }]}
          action={renameCategoryAction}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={onSelect}
            aria-current={active ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
          >
            {category.image ? (
              <span className="relative h-7 w-10 shrink-0 overflow-hidden rounded bg-elevated">
                <Image src={category.image} alt="" fill sizes="40px" className="object-cover" />
              </span>
            ) : (
              <span className="h-7 w-10 shrink-0 rounded bg-gradient-to-br from-brand-600 to-brand-800" />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                active ? "font-semibold text-brand-700" : "font-medium text-fg"
              }`}
            >
              {category.name}
            </span>
            <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
              {category.subcategories.length}
            </span>
          </button>
          {/* Row tools stay visible on the active row and on touch screens; elsewhere they appear
              on hover so 27 rows of icons don't drown the names. */}
          <span
            className={`flex items-center ${
              active ? "" : "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            }`}
          >
            <ReorderArrows index={index} total={total} onMove={(d) => onMove(category.slug, d)} />
            <IconButton label={`Rename ${category.name}`} onClick={() => setEditing(true)} kind="edit" />
            <DeleteForm
              action={deleteCategoryAction}
              hidden={[{ name: "slug", value: category.slug }]}
              confirmText={`Delete “${category.name}” and its ${category.subcategories.length} subcategories? Products tagged with it lose their category.`}
            />
          </span>
        </>
      )}
    </li>
  );
}

function SubcategoryPanel({ category }: { category: StoreCategory }) {
  const [items, setItems] = useState<Subcategory[]>(category.subcategories);
  const [, startTransition] = useTransition();

  const [prev, setPrev] = useState(category.subcategories);
  if (category.subcategories !== prev) {
    setPrev(category.subcategories);
    setItems(category.subcategories);
  }

  function move(slug: string, dir: -1 | 1) {
    const i = items.findIndex((s) => s.slug === slug);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    startTransition(() => reorderSubcategoriesAction(category.slug, next.map((s) => s.slug)));
  }

  return (
    <div>
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          {category.name}
        </h2>
        <p className="text-sm text-muted">
          {items.length} subcategor{items.length === 1 ? "y" : "ies"} · /categories/{category.slug}
        </p>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <CategoryImageForm key={category.slug} category={category} />

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Subcategories
          </h3>
          <div className="mt-3">
            <NewNameForm
              key={`sub-${category.slug}-${items.length}`}
              action={createSubcategoryAction}
              placeholder="New subcategory name"
              addLabel="Add"
              hidden={[{ name: "category", value: category.slug }]}
            />
          </div>

      <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
        {items.map((s, i) => (
          <SubcategoryRow
            key={s.slug}
            categorySlug={category.slug}
            sub={s}
            index={i}
            total={items.length}
            onMove={move}
          />
        ))}
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">No subcategories yet.</li>
        )}
      </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * The category's tile photo on the home "Shop by category" grid. Optional — without one the grid
 * draws a brand-blue gradient tile, so the section looks finished either way.
 */
function CategoryImageForm({ category }: { category: StoreCategory }) {
  const [state, action] = useActionState<ActionState, FormData>(setCategoryImageAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={category.slug} />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
        Home tile image
      </h3>
      <p className="mt-1 text-sm text-muted">
        The photo on the home page&apos;s “Shop by category” grid. Optional; without one the tile
        is brand blue.
      </p>
      <div className="mt-3">
        <ImageInput
          name="image"
          current={category.image}
          removeName="remove"
          hint="Wide shot, about 16:10 · up to 5 MB"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" variant="secondary">
          Save image
        </SubmitButton>
        <FormMessage state={state} inline />
      </div>
    </form>
  );
}

function SubcategoryRow({
  categorySlug,
  sub,
  index,
  total,
  onMove,
}: {
  categorySlug: string;
  sub: Subcategory;
  index: number;
  total: number;
  onMove: (slug: string, dir: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prevName, setPrevName] = useState(sub.name);
  if (sub.name !== prevName) {
    setPrevName(sub.name);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-1 px-3 py-2">
      {editing ? (
        <RenameForm
          initial={sub.name}
          hidden={[
            { name: "category", value: categorySlug },
            { name: "slug", value: sub.slug },
          ]}
          action={renameSubcategoryAction}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{sub.name}</span>
          <ReorderArrows index={index} total={total} onMove={(d) => onMove(sub.slug, d)} />
          <IconButton label="Rename" onClick={() => setEditing(true)} kind="edit" />
          <DeleteForm
            action={deleteSubcategoryAction}
            hidden={[
              { name: "category", value: categorySlug },
              { name: "slug", value: sub.slug },
            ]}
            confirmText={`Delete the subcategory “${sub.name}”?`}
          />
        </>
      )}
    </li>
  );
}

type Hidden = { name: string; value: string };

function NewNameForm({
  action,
  placeholder,
  addLabel,
  hidden,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  placeholder: string;
  addLabel: string;
  hidden?: Hidden[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        {hidden?.map((h) => <input key={h.name} type="hidden" name={h.name} value={h.value} />)}
        <TextInput name="name" placeholder={placeholder} required className="flex-1 py-2" />
        <SubmitButton size="sm">+ {addLabel}</SubmitButton>
      </div>
      <FormMessage state={state} inline />
    </form>
  );
}

function RenameForm({
  initial,
  hidden,
  action,
  onCancel,
}: {
  initial: string;
  hidden: Hidden[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="flex min-w-0 flex-1 items-center gap-2">
      {hidden.map((h) => <input key={h.name} type="hidden" name={h.name} value={h.value} />)}
      <TextInput name="name" defaultValue={initial} required autoFocus className="min-w-0 flex-1 py-2" />
      <SubmitButton size="sm">Save</SubmitButton>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-elevated"
      >
        Cancel
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

/** Deletes on submit, after a confirm — a one-click trash can was too easy to hit by accident. */
function DeleteForm({
  action,
  hidden,
  confirmText,
}: {
  action: (form: FormData) => void;
  hidden: Hidden[];
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {hidden.map((h) => <input key={h.name} type="hidden" name={h.name} value={h.value} />)}
      <IconButton label="Delete" kind="delete" type="submit" />
    </form>
  );
}

function ReorderArrows({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <span className="flex flex-col leading-none">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label="Move up"
        className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === total - 1}
        aria-label="Move down"
        className="px-1 text-muted hover:text-brand-700 disabled:opacity-30"
      >
        ↓
      </button>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  kind,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  kind: "edit" | "delete";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      className={`rounded-lg p-1.5 transition-colors hover:bg-elevated ${
        kind === "delete" ? "text-muted hover:text-danger" : "text-muted hover:text-brand-700"
      }`}
    >
      {kind === "edit" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
