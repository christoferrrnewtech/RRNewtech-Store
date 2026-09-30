"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { FormMessage, Honeypot, SubmitButton } from "@/components/ui/FormControls";
import { sendInquiryAction } from "@/app/(store)/actions";
import type { ActionState } from "@/lib/form-data";
import { trackContact } from "@/lib/analytics";

/**
 * Contact / sales inquiry form. Submits to `sendInquiryAction`, which records the message in
 * Firestore for the team to work from /admin/inquiries.
 *
 * When the visitor arrived from a product priced on request ("Contact a sales agent"), the page
 * passes that product down and the hidden slug fields travel with the message — the action
 * re-resolves them server-side, so the stored record can't be faked from the query string.
 *
 * A signed-in customer gets their details prefilled. Convenience, but also the thing that keeps
 * the inquiry findable on /account by email rather than only by uid — the reason they're
 * *editable* is that a clinic may genuinely want a reply somewhere else, which is exactly why the
 * stored `userId` can't be derived from whatever ends up in this box.
 */
export function ContactForm({
  product,
  customer,
}: {
  product?: { brandSlug: string; productSlug: string; name: string; href: string };
  customer?: { name: string; email: string; phone: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(sendInquiryAction, {});

  // Meta Contact / GA conversion. `state.ok` only changes on a successful submit, and the form is then
  // replaced by the confirmation, so this fires once per message sent.
  useEffect(() => {
    if (state.ok) trackContact();
  }, [state.ok]);

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted-light focus:border-brand-500";
  const label = "flex flex-col gap-1.5 text-sm font-medium text-fg";

  // On success the form is replaced rather than reset: re-submitting the same message by accident
  // would just create a duplicate for sales to dedupe.
  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden="true">
            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          Message sent
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{state.ok}</p>
        <LinkButton href="/" variant="secondary" className="mt-6">
          Continue shopping
        </LinkButton>
      </div>
    );
  }

  return (
    /* The form sits in its own panel rather than loose on the page background, so the input column
       reads as one object against the contact cards beside it. */
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <Honeypot />

      {product && (
        <input type="hidden" name="brand" value={product.brandSlug} />
      )}
      {product && (
        <input type="hidden" name="product" value={product.productSlug} />
      )}

      {/* Two pairs of short fields, then the message full width. The pairs collapse to one column
          below sm — side-by-side inputs on a phone leave neither wide enough to read. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Full name
          <input
            required
            name="name"
            autoComplete="name"
            defaultValue={customer?.name ?? ""}
            className={field}
            placeholder="Juan dela Cruz"
          />
        </label>
        <label className={label}>
          Clinic or company
          {/* `clinic`, NOT `company`: that name belongs to the honeypot above, and the action
              discards as a bot any submission that fills it. Optional — a practitioner buying for
              themselves has nothing to put here. */}
          <input
            name="clinic"
            autoComplete="organization"
            className={field}
            placeholder="Optional"
          />
        </label>
        <label className={label}>
          Email
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            defaultValue={customer?.email ?? ""}
            className={field}
            placeholder="you@email.com"
          />
        </label>
        <label className={label}>
          Mobile number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={customer?.phone ?? ""}
            className={field}
            placeholder="09xx xxx xxxx"
          />
        </label>
      </div>

      <label className={label}>
        What do you need?
        <textarea
          required
          name="message"
          rows={5}
          className={field}
          defaultValue={product ? `I'd like a quote for ${product.name}.\n\n` : ""}
          placeholder="Products, quantities, or the equipment you are planning for…"
        />
      </label>

      <FormMessage state={state} />

      <SubmitButton size="lg" className="sm:self-start">
        Send request
      </SubmitButton>

      <p className="text-xs text-muted-light">
        We usually reply within one business day. Prefer to talk?{" "}
        <Link href="/about" className="font-medium text-brand-700 hover:underline">
          More ways to reach us
        </Link>
        .
      </p>
    </form>
  );
}
