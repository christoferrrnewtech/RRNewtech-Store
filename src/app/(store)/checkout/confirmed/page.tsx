import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SITE } from "@/lib/constants";
import { ClearCart } from "./ClearCart";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};

/**
 * Post-checkout confirmation.
 *
 * Deliberately does NOT look the order up from `?ref=`. The reference is echoed back and nothing
 * more, so someone guessing at codes learns nothing about anyone's name, address or basket. The
 * customer already knows what they ordered; staff read the real record in /admin/orders.
 */
export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <Container className="py-16">
      <ClearCart />

      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden="true">
            <path
              d="M5 12l4 4L19 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
          Order received
        </h1>

        {ref && (
          <p className="mt-4 inline-block rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted">
            Reference{" "}
            <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-wide text-fg">
              {ref}
            </span>
          </p>
        )}

        <p className="mt-5 leading-relaxed text-muted">
          Thank you — we have your order. Our team will confirm stock, shipping and payment with you
          by email or phone, usually within one business day. Nothing is charged until then.
        </p>

        <p className="mt-3 text-sm text-muted">
          Questions about this order? Email {SITE.email} and quote your reference.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/" size="lg">
            Continue shopping
          </LinkButton>
          <LinkButton href="/contact" variant="secondary" size="lg">
            Contact us
          </LinkButton>
        </div>
      </div>
    </Container>
  );
}
