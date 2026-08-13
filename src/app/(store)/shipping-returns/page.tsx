import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SITE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatPHP } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Shipping options, delivery times, and the returns policy for orders from R&R Newtech Dental Corporation across the Philippines.",
  alternates: { canonical: "/shipping-returns" },
};

export default function ShippingReturnsPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Shipping &amp; Returns
      </h1>
      <p className="mt-2 text-sm text-muted-light">
        Policy details below are placeholders — confirm final terms before launch.
      </p>

      <div className="mt-8 space-y-8 text-base leading-relaxed text-muted">
        <section>
          <h2 className="text-lg font-bold text-fg">Nationwide shipping</h2>
          <p className="mt-2">
            We deliver to clinics and homes across the Philippines with JRS Express, with tracking on
            every order. Delivery typically takes 2–5 business days for Metro Manila and 3–7 business
            days for provincial addresses, depending on the location.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Shipping fees</h2>
          <p className="mt-2">
            Delivery is rated by JRS Express from the size and weight of your order and the city and
            province it&apos;s going to, so you see the actual courier charge on your order summary
            before you pay — not an estimate. Orders over {formatPHP(FREE_SHIPPING_THRESHOLD)} ship
            free. Bulk or oversized equipment orders may be quoted separately — our team will confirm
            before dispatch.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-fg">Returns &amp; replacements</h2>
          <p className="mt-2">
            Damaged, defective, or incorrect items may be returned or replaced within 7 days of
            delivery. For hygiene and safety reasons, opened consumables and sterile products cannot
            be returned unless they arrived damaged or defective.
          </p>
          <p className="mt-2">
            To start a return, email {SITE.email} with your order details and photos of the item.
          </p>
        </section>
      </div>
    </Container>
  );
}
