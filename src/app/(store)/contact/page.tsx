import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "./ContactForm";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with R&R Newtech Dental Corporation for orders, bulk pricing, and product inquiries. PH-based support, Monday to Saturday.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="py-12">
      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
            Contact us
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Questions about a product, an order, or bulk pricing for your clinic? Send us a message
            and our team will get back to you.
          </p>
          <div className="mt-8">
            <Suspense fallback={<p className="text-muted">Loading form…</p>}>
              <ContactForm />
            </Suspense>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-base font-bold text-fg">Reach us directly</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-light">Email</dt>
              <dd>
                <a href={`mailto:${SITE.email}`} className="font-medium text-brand-700 hover:text-brand-800">
                  {SITE.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-light">Phone</dt>
              <dd className="font-medium text-fg">{SITE.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-light">Support hours</dt>
              <dd className="font-medium text-fg">{SITE.supportLine}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Container>
  );
}
