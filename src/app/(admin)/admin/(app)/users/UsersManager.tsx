"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  createUserAction,
  deleteUserAction,
  updateUserBrandsAction,
} from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/lib/form-data";
import { Field, SaveBar, SubmitButton, TextInput } from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";
import { Initials } from "@/components/admin/Initials";

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Left — teammate list */}
      <div className="self-start rounded-2xl border border-line bg-surface lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-fg">Teammates</h2>
            <p className="text-xs text-muted">{users.length} with brand access</p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(ADD)}
            disabled={selected === ADD}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </div>

        {users.length > 0 ? (
          <ul className="space-y-1 p-2">
            {users.map((u) => (
              <li key={u.uid}>
                <button
                  type="button"
                  onClick={() => setSelected(u.uid)}
                  className={[
                    "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                    selected === u.uid
                      ? "bg-brand-50 ring-1 ring-brand-200"
                      : "hover:bg-elevated/60",
                  ].join(" ")}
                >
                  <Avatar name={u.name} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        selected === u.uid ? "text-brand-700" : "text-fg"
                      }`}
                    >
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {u.brandSlugs.length} brand{u.brandSlugs.length === 1 ? "" : "s"} · {u.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">No teammates yet.</p>
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

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  return <Initials name={name} size={size === "lg" ? "lg" : "md"} hideOnPhone={false} />;
}

/** Selectable brand cards — logo on a white plate, brand-blue ring when granted. */
function BrandAccessGrid({ brands, selected }: { brands: BrandOption[]; selected: string[] }) {
  const set = new Set(selected);
  if (brands.length === 0) {
    return <p className="text-sm text-muted">No brands to assign yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
          <div className="relative aspect-[2/1] bg-white">
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
    <Panel
      title="Add a marketing teammate"
      description="They can edit only the brand pages you grant below — nothing else."
    >
      <form action={action} className="space-y-5">
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

        <Field label="Brand access" hint="Tick the brands this person may edit." group>
          <BrandAccessGrid brands={brands} selected={[]} />
        </Field>

        <SaveBar state={state} label="Create account" pendingLabel="Creating…" />
      </form>
    </Panel>
  );
}

function EditPanel({ user, brands }: { user: Teammate; brands: BrandOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(updateUserBrandsAction, {});

  return (
    <div className="space-y-6">
      <Panel>
        <div className="-mt-1 mb-6 flex items-center gap-4">
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

        <form action={action}>
          <input type="hidden" name="uid" value={user.uid} />
          <Field label="Brands this person can edit" group>
            <BrandAccessGrid brands={brands} selected={user.brandSlugs} />
          </Field>
          <SaveBar state={state} label="Save access" />
        </form>
      </Panel>

      <Panel
        tone="danger"
        title="Remove teammate"
        description={`Deletes ${user.name}’s account and sign-in access. This can’t be undone.`}
      >
        <form
          action={deleteUserAction}
          onSubmit={(e) => {
            if (!confirm(`Remove ${user.name}? Their account is deleted.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="uid" value={user.uid} />
          <SubmitButton variant="danger" size="sm" pendingLabel="Removing…">
            Remove {user.name}
          </SubmitButton>
        </form>
      </Panel>
    </div>
  );
}
