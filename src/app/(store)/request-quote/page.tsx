import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { QuoteForm } from "./QuoteForm";
import { SITE } from "@/lib/constants";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerName } from "@/lib/customers";
import { formatPhone } from "@/lib/customer-fields";

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Send your equipment or consumables list and get a consolidated quotation from R&R Newtech Dental Corporation — pricing, availability and delivery timelines, usually within one business day.",
  alternates: { canonical: "/request-quote" },
};

/**
 * The "Request a quote" destination, separate from /contact.
 *
 * Both write an inquiry, but they are not the same errand: /contact is a question, this is a
 * priced list. It asks for delivery location and timeline because those are what sales would
 * otherwise have to write back for, and it stores `kind: "quote"` so the two don't blur together
 * in the admin queue.
 */
export default async function RequestQuotePage() {
  const customer = await getCurrentCustomer().catch(() => null);

  return (
    <Container className="py-12">
      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
            Request a quote
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Tell us what your clinic needs. Our team replies with pricing, availability and
            delivery timelines — usually within one business day.
          </p>

          <div className="mt-8">
            <Suspense fallback={<p className="text-muted">Loading form…</p>}>
              <QuoteForm
                customer={
                  customer
                    ? {
                        name: customerName(customer),
                        email: customer.email,
                        // Same reasoning as /contact: the shape the customer recognises from
                        // /account, not the canonical 11 digits it is stored as.
                        phone: formatPhone(customer.phone),
                      }
                    : undefined
                }
              />
            </Suspense>
          </div>
        </div>

        <aside className="h-fit space-y-4">
          <Step n={1} title="Send your list">
            Include quantities and any brand preference. A photo of an existing unit helps for
            replacements.
          </Step>
          <Step n={2} title="We price it">
            We confirm availability and lead time per line, including items not listed on the
            store.
          </Step>
          <Step n={3} title="You get one quotation">
            A single consolidated quote with delivery timelines, valid for 30 days.
          </Step>

          <div className="rounded-2xl bg-brand-50 p-5">
            <h2 className="text-sm font-bold text-fg">Prefer to talk it through?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {SITE.supportLine}
            </p>
            <div className="mt-3 space-y-0.5 text-sm">
              {SITE.phones.map((p) => (
                <a
                  key={p.tel}
                  href={`tel:${p.tel}`}
                  className="block font-medium text-brand-700 hover:underline"
                >
                  {p.label ? `${p.label}: ${p.value}` : p.value}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Container>
  );
}

/** One numbered step in the "what happens next" rail beside the form. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
        >
          {n}
        </span>
        <h2 className="text-sm font-bold text-fg">{title}</h2>
      </div>
      <p className="mt-1.5 pl-[34px] text-sm leading-relaxed text-muted">{children}</p>
    </section>
  );
}
