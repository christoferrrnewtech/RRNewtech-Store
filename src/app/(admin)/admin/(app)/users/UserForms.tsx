"use client";

import { useActionState } from "react";
import {
  createUserAction,
  deleteUserAction,
  updateUserBrandsAction,
  type ActionState,
} from "@/app/(admin)/admin/actions";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/admin/Form";

type BrandOption = { slug: string; name: string };

function BrandCheckboxes({
  brands,
  selected,
}: {
  brands: BrandOption[];
  selected: string[];
}) {
  const set = new Set(selected);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {brands.map((b) => (
        <label key={b.slug} className="flex items-center gap-2.5 text-sm text-fg">
          <input
            type="checkbox"
            name="brandSlugs"
            value={b.slug}
            defaultChecked={set.has(b.slug)}
          />
          {b.name}
        </label>
      ))}
    </div>
  );
}

export function UserRow({
  user,
  brands,
}: {
  user: { id: string; name: string; email: string; brandSlugs: string[] };
  brands: BrandOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateUserBrandsAction, {});

  return (
    <li className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-fg">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <form action={deleteUserAction}>
          <input type="hidden" name="id" value={user.id} />
          <SubmitButton variant="danger">Remove</SubmitButton>
        </form>
      </div>

      <form action={action} className="mt-5 space-y-4 border-t border-line pt-5">
        <input type="hidden" name="id" value={user.id} />
        <Field label="Brands this person can edit">
          <BrandCheckboxes brands={brands} selected={user.brandSlugs} />
        </Field>
        <SubmitButton variant="secondary">Update access</SubmitButton>
        <FormMessage state={state} />
      </form>
    </li>
  );
}

export function NewUserForm({ brands }: { brands: BrandOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createUserAction, {});

  return (
    <section className="mt-12">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        Add a marketing account
      </h2>

      <form action={action} className="mt-4 space-y-5 rounded-2xl border border-line bg-surface p-6">
        <Field label="Full name">
          <TextInput name="name" required />
        </Field>
        <Field label="Email">
          <TextInput name="email" type="email" required />
        </Field>
        <Field label="Password" hint="At least 8 characters. Share it with them directly — it's stored hashed and can't be read back.">
          <TextInput name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Brands this person can edit">
          <BrandCheckboxes brands={brands} selected={[]} />
        </Field>
        <SubmitButton>Create account</SubmitButton>
        <FormMessage state={state} />
      </form>
    </section>
  );
}
