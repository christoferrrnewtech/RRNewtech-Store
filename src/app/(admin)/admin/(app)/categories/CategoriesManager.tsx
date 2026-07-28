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
  type ActionState,
} from "@/app/(admin)/admin/actions";
import { FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";
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
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Left — categories */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category…"
            className="min-w-0 flex-1"
          />
        </div>

        <div className="mt-4">
          <NewNameForm
            key={`cat-${items.length}`}
            action={createCategoryAction}
            placeholder="New category name"
            addLabel="New Category"
          />
        </div>

        <ul className="mt-4 divide-y divide-line">
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

      {/* Right — subcategories of the selected category */}
      <div className="rounded-2xl border border-line bg-surface p-5">
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
    <li className={`flex items-center gap-2 py-2 ${active ? "bg-brand-50" : ""} rounded-lg px-2`}>
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
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-fg"
          >
            {category.name}
            <span className="ml-2 text-xs font-normal text-muted-light">
              {category.subcategories.length} sub
            </span>
          </button>
          <ReorderArrows index={index} total={total} onMove={(d) => onMove(category.slug, d)} />
          <IconButton label="Rename" onClick={() => setEditing(true)} kind="edit" />
          <DeleteForm action={deleteCategoryAction} hidden={[{ name: "slug", value: category.slug }]} />
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
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        {category.name}
      </h2>
      <p className="text-sm text-muted">Subcategories under this category</p>

      <div className="mt-4">
        <NewNameForm
          key={`sub-${category.slug}-${items.length}`}
          action={createSubcategoryAction}
          placeholder="New subcategory name"
          addLabel="New Subcategory"
          hidden={[{ name: "category", value: category.slug }]}
        />
      </div>

      <ul className="mt-4 divide-y divide-line">
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
    <li className="flex items-center gap-2 rounded-lg px-2 py-2">
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
        <TextInput name="name" placeholder={placeholder} required className="flex-1" />
        <SubmitButton>{addLabel}</SubmitButton>
      </div>
      <FormMessage state={state} />
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
      <TextInput name="name" defaultValue={initial} required autoFocus className="min-w-0 flex-1" />
      <SubmitButton>Save</SubmitButton>
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

function DeleteForm({ action, hidden }: { action: (form: FormData) => void; hidden: Hidden[] }) {
  return (
    <form action={action}>
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
