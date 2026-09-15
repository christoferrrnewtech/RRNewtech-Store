"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { FormMessage, Honeypot, SubmitButton } from "@/components/ui/FormControls";
import { sendInquiryAction } from "@/app/(store)/actions";
import type { ActionState } from "@/lib/form-data";

/**
 * Quote request form. Shares `sendInquiryAction` with /contact rather than duplicating it — the
 * hidden `kind` field is what separates the two in the admin queue, and the action validates it
 * against the vocabulary instead of trusting what is posted.
 *
 * The field set is deliberately the same as /contact's — what differs is the errand, not the
 * details asked for. Anything else sales needs (delivery address, urgency) is a reply away, and
 * belongs there rather than in front of a visitor who wants a price.
 */
export function QuoteForm({
  customer,
}: {
  customer?: { name: string; email: string; phone: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(sendInquiryAction, {});

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted-light focus:border-brand-500";
  const label = "flex flex-col gap-1.5 text-sm font-medium text-fg";

  // Replaced rather than reset, as on /contact: re-sending the same list would only create a
  // duplicate for sales to reconcile.
  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden="true">
            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          Quote request sent
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Our sales team will come back with pricing, availability and delivery timelines — usually
          within one business day.
        </p>
        <LinkButton href="/shop" variant="secondary" className="mt-6">
          Browse products
        </LinkButton>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <Honeypot />

      {/* What tells this apart from a general contact message once it reaches /admin/inquiries. */}
      <input type="hidden" name="kind" value="quote" />

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
          {/* `clinic`, NOT `company` — that name is the honeypot's, and the action discards as a
              bot anything that fills it. See ContactForm for the same note. */}
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
        Equipment or products needed
        <textarea
          required
          name="message"
          rows={6}
          className={field}
          placeholder={"List the items and quantities, e.g.\n2 × dental chair\n10 boxes composite A2\n1 × intraoral scanner"}
        />
      </label>

      <FormMessage state={state} />

      <SubmitButton size="lg" pendingLabel="Sending…" className="sm:self-start">
        Send request
      </SubmitButton>

      <p className="text-xs text-muted-light">
        We reply with a consolidated quotation, usually within one business day. Just have a
        question?{" "}
        <Link href="/contact" className="font-medium text-brand-700 hover:underline">
          Send us a message instead
        </Link>
        .
      </p>
    </form>
  );
}
