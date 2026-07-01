import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { FAQS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers about ordering, nationwide delivery, bulk pricing, and payment methods at R&R Newtech Dental Corporation.",
  alternates: { canonical: "/faq" },
};

// FAQ structured data for rich results.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <Container className="py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Frequently asked questions
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Everything you need to know about ordering from R&amp;R Newtech Dental.
      </p>

      <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-fg">
              {f.q}
              <span className="text-brand-600 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Container>
  );
}
