import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in or create an R&R Newtech Dental account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
        Coming soon
      </span>
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Accounts are on the way
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Sign in and registration — with order history and faster checkout — are coming soon. In the
        meantime you can browse the shop and build your cart.
      </p>
      <LinkButton href="/" size="lg" className="mt-8">
        Continue shopping
      </LinkButton>
    </Container>
  );
}
