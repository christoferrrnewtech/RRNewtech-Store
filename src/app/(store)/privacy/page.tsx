import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How R&R Newtech Dental Corporation collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-light">
        Placeholder policy — have legal counsel review before launch.
      </p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted">
        <p>
          {SITE.legalName} (&quot;we&quot;) respects your privacy. This policy explains what
          information we collect and how we use it when you visit {SITE.domain} or contact us.
        </p>
        <section>
          <h2 className="text-lg font-bold text-fg">Information we collect</h2>
          <p className="mt-2">
            Contact details you provide (name, email, phone) when you send an inquiry or place an
            order, and standard analytics data (pages viewed, device, and general location) used to
            improve the site and our marketing.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">How we use it</h2>
          <p className="mt-2">
            To respond to inquiries, process and deliver orders, provide support, and — where you
            have consented — send updates and promotions. We do not sell your personal information.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Cookies &amp; analytics</h2>
          <p className="mt-2">
            We use cookies and tools such as Google Analytics and the Meta Pixel to understand site
            usage and measure advertising. You can control cookies through your browser settings.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Contact</h2>
          <p className="mt-2">
            For any privacy request, email us at {SITE.email}. This policy complies in spirit with
            the Philippine Data Privacy Act of 2012.
          </p>
        </section>
      </div>
    </Container>
  );
}
