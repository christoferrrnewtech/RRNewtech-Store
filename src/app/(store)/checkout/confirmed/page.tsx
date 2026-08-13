import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SITE } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import { getOrder, type Order } from "@/lib/orders";
import { reconcileOrderPayment } from "@/lib/payments";
import { isOrderId } from "@/lib/pay-window";
import { ClearPendingPayment } from "@/components/checkout/ClearPendingPayment";
import { ClearCart } from "./ClearCart";
import { PaymentPoll } from "./PaymentPoll";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
  // The URL carries an order id. Don't hand it to picsum, GA or the Meta Pixel on the way out.
  referrer: "no-referrer",
};

/**
 * Post-checkout confirmation.
 *
 * PayMongo returns the customer here via `success_url` — which is just a URL anyone can type, so
 * ARRIVING HERE IS NOT PROOF OF PAYMENT. The page reads the real state out of Firestore, and
 * reconciles against the gateway when it's still pending, so the words on screen are always the
 * truth rather than an assumption.
 *
 * It looks the order up by `?o=` (the Firestore document id) and NOT by `?ref=`. The original
 * objection to looking orders up here was enumeration, and it still stands for refs: six
 * characters from a thirty-character alphabet is guessable at scale. A Firestore auto-id is twenty
 * characters from sixty-two — about 119 bits — so it can't be guessed. `ref` is still cross-checked
 * against the document, and the page renders ONLY payment state, reference, item count and total:
 * never a name, address, email or line item, because a URL leaks through history and screenshots
 * and the blast radius of a leaked id should stay at "order RR-8F3K2M is paid, ₱3,150".
 *
 * With no `?o=` — the manual path, when PayMongo isn't configured — it renders exactly what it
 * always did.
 */
export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; o?: string }>;
}) {
  const { ref, o } = await searchParams;

  let order: Order | undefined;
  // `isOrderId` is not about authenticity — the id is the capability. It stops a value like
  // "a%2Fb" reaching `.doc()`, where an odd-segment path makes Firestore throw and turns a
  // customer-facing page into a 500.
  if (isOrderId(o)) {
    const found = await getOrder(o).catch(() => undefined);
    // A mismatched ref means the link was tampered with or mangled — fall back to anonymous.
    if (found && (!ref || found.ref === ref)) order = await reconcileOrderPayment(found);
  }

  const paid = order?.paymentStatus === "paid";
  const failed = order?.paymentStatus === "failed" || order?.paymentStatus === "expired";
  const pending = Boolean(order) && !paid && !failed;
  // The manual path has no order to wait on, so it is complete on arrival.
  const settled = paid || !order;

  return (
    <Container className="py-16">
      <ClearCart when={settled} />
      {/* The resume pointer goes the moment the order stops being resumable — including a failed
          one, which /checkout/pay would otherwise keep offering. Note the cart deliberately does
          NOT follow the same rule; see ClearCart. */}
      <ClearPendingPayment when={Boolean(order) && order?.paymentStatus !== "awaiting_payment"} />

      <div className="mx-auto max-w-xl text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            failed ? "bg-danger/10" : "bg-brand-50"
          }`}
        >
          {failed ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-danger" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden="true">
              <path
                d="M5 12l4 4L19 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
          {paid
            ? "Payment received"
            : failed
              ? "Payment didn't go through"
              : pending
                ? "Confirming your payment"
                : "Order received"}
        </h1>

        {ref && (
          <p className="mt-4 inline-block rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted">
            Reference{" "}
            <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-wide text-fg">
              {ref}
            </span>
          </p>
        )}

        {order && (
          <p className="mt-3 text-sm text-muted">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-fg">{formatPHP(order.total)}</span>
          </p>
        )}

        <p className="mt-5 leading-relaxed text-muted">
          {paid ? (
            <>
              Thank you — your payment is confirmed. Our team will pack your order and confirm
              shipping with you by email or phone, usually within one business day. Keep your
              reference handy until then.
            </>
          ) : failed ? (
            <>
              Nothing was charged. Your cart is still saved, so you can head back to checkout and
              try again with a different payment method.
            </>
          ) : pending ? (
            <>
              We&apos;re waiting for the gateway to confirm your payment. This usually takes a few
              seconds — please don&apos;t close this page.
            </>
          ) : (
            <>
              Thank you — we have your order. Our team will confirm stock, shipping and payment with
              you by email or phone, usually within one business day. Nothing is charged until then.
            </>
          )}
        </p>

        {pending && <PaymentPoll />}

        <p className="mt-3 text-sm text-muted">
          Questions about this order? Email {SITE.email} and quote your reference.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {failed ? (
            <>
              <LinkButton href="/checkout" size="lg">
                Back to checkout
              </LinkButton>
              <LinkButton href="/contact" variant="secondary" size="lg">
                Contact us
              </LinkButton>
            </>
          ) : (
            <>
              <LinkButton href="/" size="lg">
                Continue shopping
              </LinkButton>
              <LinkButton href="/contact" variant="secondary" size="lg">
                Contact us
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
