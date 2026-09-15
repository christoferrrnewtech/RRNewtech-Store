"use client";

import Image from "next/image";
import { useActionState } from "react";
import { setCategoryImageAction } from "@/app/(admin)/admin/actions";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";
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
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          On the landing page
        </h2>
        <p className="mt-1 text-sm text-muted">
          These {shown.length} tiles, in this order. Position and product count are worked out from
          how many products sit in each category — they aren&apos;t typed in.
        </p>

        {shown.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-muted">
            No category has any products in it yet, so the section is hidden on the storefront.
          </p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {shown.map((category, i) => (
              <TileCard key={category.slug} category={category} position={i + 1} />
            ))}
          </div>
        )}
      </section>

      {empty.length > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            Nothing in them yet
          </h2>
          <p className="mt-1 text-sm text-muted">
            The grid never links somewhere empty, so these can&apos;t appear at all until a product
            is tagged into them — a photo alone won&apos;t bring one back.
          </p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {empty.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="truncate text-sm font-medium text-muted">{c.name}</span>
                <span className="shrink-0 text-xs text-muted-light">No products</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            Below the cut
          </h2>
          <p className="mt-1 text-sm text-muted">
            The grid stops at {limit} tiles. These have products but sit below the cut — they&apos;ll
            appear here if their product counts overtake one of the above.
          </p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {hidden.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="truncate text-sm font-medium text-muted">{c.name}</span>
                <span className="shrink-0 text-xs text-muted-light">
                  {c.count} {c.count === 1 ? "product" : "products"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One tile: what it looks like on the storefront, and the control to change its photo. */
function TileCard({ category, position }: { category: CategoryWithCount; position: number }) {
  const [state, action] = useActionState<ActionState, FormData>(setCategoryImageAction, {});

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Same 16:10 box and gradient fallback the storefront tile uses, so this preview is honest
          about what a missing photo actually looks like rather than showing an empty grey slot. */}
      <div className="relative flex aspect-[16/10] items-end bg-brand-800">
        {category.image ? (
          <Image
            src={category.image}
            alt=""
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-0.5 text-xs font-bold text-fg">
          {position}
        </span>

        <div className="relative p-4">
          <p className="font-[family-name:var(--font-display)] font-bold leading-snug text-white">
            {category.name}
          </p>
          <p className="mt-0.5 text-sm text-white/70">
            {category.count} {category.count === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <form action={action} className="space-y-3 p-4">
        <input type="hidden" name="slug" value={category.slug} />
        <Field
          label={category.image ? "Replace photo" : "Add a photo"}
          hint="Wide shot, roughly 16:10 · up to 5 MB."
        >
          <TextInput type="file" name="image" accept="image/*" />
        </Field>
        {category.image && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remove" value="1" />
            Remove the current photo
          </label>
        )}
        <SubmitButton>Save</SubmitButton>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
