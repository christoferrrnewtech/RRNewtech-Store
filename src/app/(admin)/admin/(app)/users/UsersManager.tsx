"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  createUserAction,
  deleteUserAction,
  updateUserBrandsAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

export type Teammate = { uid: string; name: string; email: string; brandSlugs: string[] };
export type BrandOption = { slug: string; name: string; logo: string };

const ADD = "add" as const;
type Selection = string | typeof ADD;

/** Master–detail manager for marketing teammates: a left rail + a right create/edit panel. */
export function UsersManager({
  users,
  brands,
}: {
  users: Teammate[];
  brands: BrandOption[];
}) {
  const [selected, setSelected] = useState<Selection>(users[0]?.uid ?? ADD);

  // Reconcile selection when the server sends a new list (after add/edit), React's render-time
  // pattern — mirrors BannerManager.
  const [prev, setPrev] = useState(users);
  if (users !== prev) {
    const added = users.find((u) => !prev.some((p) => p.uid === u.uid));
    setPrev(users);
    if (added) setSelected(added.uid);
    else if (selected !== ADD && !users.some((u) => u.uid === selected)) {
      setSelected(users[0]?.uid ?? ADD);
    }
  }

  const current = users.find((u) => u.uid === selected);

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      {/* Left — teammate list */}
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
          Add teammate
        </button>

        {users.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {users.map((u) => (
              <li key={u.uid}>
                <button
                  type="button"
                  onClick={() => setSelected(u.uid)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border bg-surface p-2.5 text-left transition-colors",
                    selected === u.uid
                      ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                      : "border-line hover:border-line-strong",
                  ].join(" ")}
                >
                  <Avatar name={u.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{u.name}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-bg p-4 text-sm text-muted">
            No teammates yet. Add your first above.
          </p>
        )}
      </div>

      {/* Right — panel */}
      <div className="min-w-0">
        {selected === ADD || !current ? (
          <AddPanel brands={brands} />
        ) : (
          <EditPanel key={current.uid} user={current} brands={brands} />
        )}
      </div>
    </div>
  );
}

/** Initials avatar with a deterministic color from the name. */
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const palette = [
    "bg-brand-600",
    "bg-emerald-600",
    "bg-violet-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-sky-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = palette[hash % palette.length];
  const dims = size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return (
    <span
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-bold text-white ${color}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** Selectable brand cards — logo on a white plate, brand-blue ring when granted. */
function BrandAccessGrid({ brands, selected }: { brands: BrandOption[]; selected: string[] }) {
  const set = new Set(selected);
  if (brands.length === 0) {
    return <p className="text-sm text-muted">No brands to assign yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {brands.map((b) => (
        <label
          key={b.slug}
          className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-brand-300 has-[:checked]:border-brand-600 has-[:checked]:ring-2 has-[:checked]:ring-brand-600/30"
        >
          <input
            type="checkbox"
            name="brandSlugs"
            value={b.slug}
            defaultChecked={set.has(b.slug)}
            className="peer absolute right-2 top-2 z-10 h-4 w-4"
          />
          <div className="relative aspect-[16/10] bg-white">
            <Image src={b.logo} alt="" fill sizes="160px" className="object-contain p-4" />
          </div>
          <div className="border-t border-line px-2.5 py-2">
            <p className="truncate text-xs font-medium text-fg">{b.name}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

/** Small helper for the generate-password button. */
function randomPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const rnd = new Uint32Array(12);
  crypto.getRandomValues(rnd);
  for (const n of rnd) out += chars[n % chars.length];
  return out;
}

function AddPanel({ brands }: { brands: BrandOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createUserAction, {});
  const [password, setPassword] = useState("");

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M22 11h-6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">
            Add a marketing teammate
          </h2>
          <p className="mt-1 text-sm text-muted">
            They can edit only the brand pages you grant below — nothing else. The account is created
            in Firebase Authentication.
          </p>
        </div>
      </div>

      <form action={action} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <TextInput name="name" required placeholder="e.g. Maria Santos" />
          </Field>
          <Field label="Email">
            <TextInput name="email" type="email" required placeholder="name@example.com" />
          </Field>
        </div>

        <Field label="Password" hint="At least 8 characters. Share it with them directly.">
          <div className="flex gap-2">
            <TextInput
              name="password"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set or generate a password"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-brand-700 hover:bg-elevated"
            >
              Generate
            </button>
          </div>
        </Field>

        <Field label="Brand access" hint="Tick the brands this person may edit.">
          <BrandAccessGrid brands={brands} selected={[]} />
        </Field>

        <SubmitButton>Create account</SubmitButton>
        <FormMessage state={state} />
      </form>
    </div>
  );
}

function EditPanel({ user, brands }: { user: Teammate; brands: BrandOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(updateUserBrandsAction, {});

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-bold text-fg">
            {user.name}
          </h2>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <span className="ml-auto rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold text-muted">
          Marketing
        </span>
      </div>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="uid" value={user.uid} />
        <Field label="Brands this person can edit">
          <BrandAccessGrid brands={brands} selected={user.brandSlugs} />
        </Field>
        <SubmitButton variant="secondary">Save access</SubmitButton>
        <FormMessage state={state} />
      </form>

      <div className="mt-8 border-t border-line pt-5">
        <h3 className="text-sm font-semibold text-fg">Remove teammate</h3>
        <p className="mt-1 text-sm text-muted">
          Deletes {user.name}&rsquo;s account and sign-in access. This can&rsquo;t be undone.
        </p>
        <form action={deleteUserAction} className="mt-3">
          <input type="hidden" name="uid" value={user.uid} />
          <SubmitButton variant="danger">Remove {user.name}</SubmitButton>
        </form>
      </div>
    </div>
  );
}
