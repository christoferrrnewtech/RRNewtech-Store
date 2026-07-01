import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of the R&R Newtech Dental Corporation website and store.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-light">
        Placeholder terms — have legal counsel review before launch.
      </p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted">
        <p>
          By using {SITE.domain}, you agree to these terms. {SITE.legalName} may update them from
          time to time; continued use means you accept the changes.
        </p>
        <section>
          <h2 className="text-lg font-bold text-fg">Products &amp; pricing</h2>
          <p className="mt-2">
            We aim to keep product information, availability, and pricing accurate, but errors may
            occur. Prices are in Philippine pesos and may change without notice. We reserve the
            right to correct errors and to limit or cancel quantities.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Orders</h2>
          <p className="mt-2">
            Submitting an inquiry or order does not guarantee availability until confirmed by our
            team. Certain professional and clinical products may require proof of a valid dental or
            medical practice.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Limitation of liability</h2>
          <p className="mt-2">
            Products are provided for use by qualified professionals in accordance with
            manufacturer instructions. {SITE.legalName} is not liable for misuse or for indirect or
            consequential damages to the extent permitted by law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Contact</h2>
          <p className="mt-2">Questions about these terms? Email {SITE.email}.</p>
        </section>
      </div>
    </Container>
  );
}
