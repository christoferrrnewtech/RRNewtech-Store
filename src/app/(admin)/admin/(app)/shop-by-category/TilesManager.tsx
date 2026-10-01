"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { setCategoryImageAction } from "@/app/(admin)/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";
import type { ActionState } from "@/lib/form-data";
import type { CategoryWithCount, StoreCategory } from "@/lib/content";

/**
 * The home page's "Shop by category" grid, as an editable board.
 *
 * This exists because the tile image was only reachable by selecting a category in the Categories
 * screen, where it sits under a "Subcategories" heading — nothing there says it controls the
 * landing page, and nothing shows WHICH categories reach it. Here the tiles appear in the order
 * the storefront renders them, so uploading a photo is aimed rather than blind.
 *
 * Categories past the cut-off are still listed, greyed, so it's obvious why one isn't showing —
 * rather than looking like a category that failed to save.
 */
export function TilesManager({
  shown,
  hidden,
  empty,
  limit,
}: {
  shown: CategoryWithCount[];
  hidden: CategoryWithCount[];
  empty: StoreCategory[];
  limit: number;
}) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-fg">On the home page</h2>
          <p className="text-sm text-muted">
            {shown.length} of {limit} tiles · ordered by product count
          </p>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-sm text-muted">
            No category has any products in it yet, so the section is hidden on the storefront.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((category, i) => (
              <TileCard key={category.slug} category={category} position={i + 1} />
            ))}
          </div>
        )}
      </section>

      {(hidden.length > 0 || empty.length > 0) && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {hidden.length > 0 && (
            <Panel
              title="Below the cut"
              description={`They have products but the grid stops at ${limit}. One moves up if its product count overtakes a tile above.`}
            >
              <ChipList
                items={hidden.map((c) => ({
                  key: c.slug,
                  label: c.name,
                  meta: `${c.count}`,
                }))}
              />
            </Panel>
          )}
          {empty.length > 0 && (
            <Panel
              title="No products yet"
              description="The grid never links somewhere empty, so these can't appear until a product is tagged into them."
            >
              <ChipList items={empty.map((c) => ({ key: c.slug, label: c.name }))} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function ChipList({ items }: { items: { key: string; label: string; meta?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg/60 px-3 py-1 text-sm text-muted"
        >
          {item.label}
          {item.meta && (
            <span className="rounded-full bg-elevated px-1.5 text-[11px] font-semibold tabular-nums">
              {item.meta}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * One tile, drawn as the storefront draws it, with its photo control on top.
 *
 * Picking a file previews it IN the tile, so you see the real crop before saving; Save and Cancel
 * appear only once there's something to save. Same `image` / `remove` fields as before, so the
 * action is unchanged.
 */
function TileCard({ category, position }: { category: CategoryWithCount; position: number }) {
  const [state, action] = useActionState<ActionState, FormData>(setCategoryImageAction, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // React resets the form after a successful save; drop the pending state with it.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onReset = () => {
      setPreview(null);
      setRemoving(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const pending = preview !== null || removing;
  const shown = removing ? undefined : (preview ?? category.image);

  const cancel = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setRemoving(false);
  };

  return (
    <form
      ref={formRef}
      action={action}
      className={`overflow-hidden rounded-2xl border bg-surface transition-colors ${
        pending ? "border-brand-300 ring-1 ring-brand-200" : "border-line"
      }`}
    >
      <input type="hidden" name="slug" value={category.slug} />
      {removing && <input type="hidden" name="remove" value="1" />}

      {/* Same 16:10 box and gradient fallback the storefront tile uses, so this preview is honest
          about what a missing photo actually looks like rather than showing an empty grey slot. */}
      <div className="group relative flex aspect-[16/10] items-end bg-brand-800">
        {preview && !removing ? (
          // A blob: URL while previewing, which next/image can't optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : shown ? (
          <Image
            src={shown}
            alt=""
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-xs font-bold text-fg">
          {position}
        </span>

        <label className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-fg shadow-sm transition-colors focus-within:ring-2 focus-within:ring-brand-500 hover:bg-white">
          <input
            ref={inputRef}
            type="file"
            name="image"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
              setRemoving(false);
            }}
          />
          {category.image || preview ? "Change photo" : "Add photo"}
        </label>

        <div className="relative p-4">
          <p className="font-[family-name:var(--font-display)] font-bold leading-snug text-white">
            {category.name}
          </p>
          <p className="mt-0.5 text-sm text-white/70">
            {category.count} {category.count === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <div className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2.5">
        {pending ? (
          <>
            <SubmitButton size="sm">{removing ? "Remove photo" : "Save photo"}</SubmitButton>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-fg"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted">
              {category.image ? "Wide shot, about 16:10" : "No photo · shows brand blue"}
            </span>
            {category.image && (
              <button
                type="button"
                onClick={() => setRemoving(true)}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </>
        )}
        <div className={pending ? "" : "w-full"}>
          <FormMessage state={state} inline />
        </div>
      </div>
    </form>
  );
}
