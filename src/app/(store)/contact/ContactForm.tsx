"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { FormMessage, Honeypot, SubmitButton } from "@/components/ui/FormControls";
import { sendInquiryAction } from "@/app/(store)/actions";
import type { ActionState } from "@/lib/form-data";

/**
 * Contact / sales inquiry form. Submits to `sendInquiryAction`, which records the message in
 * Firestore for the team to work from /admin/inquiries.
 *
 * When the visitor arrived from a product priced on request ("Contact a sales agent"), the page
 * passes that product down and the hidden slug fields travel with the message — the action
 * re-resolves them server-side, so the stored record can't be faked from the query string.
 */
export function ContactForm({
  product,
}: {
  product?: { brandSlug: string; productSlug: string; name: string; href: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(sendInquiryAction, {});

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted-light focus:border-brand-500";

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
    <form action={action} className="flex flex-col gap-4">
      <Honeypot />

      {product && (
        <input type="hidden" name="brand" value={product.brandSlug} />
      )}
      {product && (
        <input type="hidden" name="product" value={product.productSlug} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
          Name
          <input required name="name" className={field} placeholder="Juan dela Cruz" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
          Phone
          <input name="phone" className={field} placeholder="09xx xxx xxxx" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        Email
        <input required type="email" name="email" className={field} placeholder="you@email.com" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        Message
        <textarea
          required
          name="message"
          rows={5}
          className={field}
          defaultValue={product ? `I'd like a quote for ${product.name}.\n\n` : ""}
          placeholder="How can we help?"
        />
      </label>

      <FormMessage state={state} />

      <SubmitButton size="lg" className="sm:self-start">
        Send message
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
