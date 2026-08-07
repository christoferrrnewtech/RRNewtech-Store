import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/FormControls";
import { ClearPendingPayment } from "@/components/checkout/ClearPendingPayment";
import { PayWindowCountdown } from "@/components/checkout/PayWindowCountdown";
import { continueToPaymentAction } from "@/app/(store)/actions";
import { SITE } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import { applyOrderPayment, getOrder, type Order } from "@/lib/orders";
import { reconcileOrderPayment } from "@/lib/payments";
import { expireCheckoutSession, isPayMongoConfigured } from "@/lib/paymongo";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_TYPES } from "@/lib/payment-methods";
import { isOrderId, isPayWindowOpen, PAY_COOKIE, PAY_WINDOW_MINUTES, parsePendingPayment } from "@/lib/pay-window";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Complete your payment",
  robots: { index: false, follow: false },
  // The URL can carry an order id and the outbound hop is to PayMongo — don't hand it to
  // picsum, GA or the Meta Pixel on the way out.
  referrer: "no-referrer",
};

/**
 * `cookies()` forces this anyway, but declare it: if this route were ever prerendered, the internal
 * render Next performs after a Server Action redirect would serve a cached shell that ignores the
 * cookie, and the whole flow would break silently. It also guarantees payment state is never cached.
 */
export const dynamic = "force-dynamic";

/**
 * The payment interstitial — where a customer lands after checkout, instead of being thrown
 * straight at PayMongo.
 *
 * It exists so leaving is survivable. The customer can close the tab, check their GCash balance,
 * ask a colleague, and come back within the hour to a page that still knows what they owe. That is
 * also why it does NOT auto-redirect: forwarding on load would make the back button from PayMongo
 * bounce them straight back out, so the page they can "return to" would be one they can never
 * actually see.
 *
 * It resolves the order from `?o=` first and the cookie second — `?o=` is the more specific
 * request, so a bookmark to order A shows A even if the cookie now points at B. Both are unsigned
 * ids, which is fine: the id IS the secret at ~119 bits, and every decision here is re-derived
 * from the order document rather than taken from the caller. Crucially the WINDOW is read from
 * `order.checkoutExpiresAt`, never from the cookie's `exp`, so nothing attacker-controlled can
 * reach `expireCheckoutSession` or `applyOrderPayment`.
 *
 * Like `/checkout/confirmed`, it renders only status, reference, item count and totals — never a
 * name, address, email or line item. A URL leaks through history and screenshots, and the blast
 * radius of a leaked id should stay at "order RR-8F3K2M owes ₱3,150".
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ o?: string }>;
}) {
  const { o } = await searchParams;
  const cookie = parsePendingPayment((await cookies()).get(PAY_COOKIE)?.value);
  const orderId = (isOrderId(o) && o) || cookie?.orderId || "";

  let order = orderId ? await getOrder(orderId).catch(() => undefined) : undefined;
  if (!order) return <NoPendingPayment />;

  // Nothing to pay through — the confirmation page already says exactly the right thing about a
  // manually-arranged order, and clears the cart. Don't duplicate that copy here.
  if (!isPayMongoConfigured()) redirect(confirmedHref(order));

  // ALWAYS before the paid check: the customer usually arrives a beat ahead of the webhook, and
  // showing a pay button for an order they've already paid would be the worst possible bug here.
  order = await reconcileOrderPayment(order);
  if (order.paymentStatus === "paid") redirect(confirmedHref(order));

  const lapsed =
    order.paymentStatus === "expired" || !isPayWindowOpen(order.checkoutExpiresAt);

  if (lapsed) {
    // Lazy expiry. Writing during a GET render is established here — /checkout/confirmed already
    // does it via reconcileOrderPayment — and this is safe for the same reasons: idempotent
    // (applyOrderPayment returns false the second time), monotonic (`paid` is terminal, so racing
    // the webhook cannot un-pay an order), best-effort (a PayMongo outage must not 500 a
    // customer's page), and gated on the order's own stored deadline.
    //
    // No revalidatePath — not permitted during render, and unnecessary: every admin page calls
    // requireAdmin() → cookies(), so none of them are cached.
    //
    // THE HOLE THIS DOESN'T CLOSE: a customer with the PayMongo tab still open who never comes
    // back here. We only expire on a visit, and PayMongo's create-session API has no expiry
    // attribute to set up front. If expireCheckoutSession succeeded the late payment is blocked;
    // if it failed they can still pay, the webhook fires, and `expired → paid` is deliberately
    // legal so the money is never lost. A scheduled sweep over
    // (paymentStatus == "awaiting_payment" && checkoutExpiresAt < now) is the proper fix and is a
    // query rather than a migration, because checkoutExpiresAt is stored. Out of scope here.
    if (order.paymentStatus !== "expired") {
      await expireCheckoutSession(order.checkoutSessionId).catch(() => false);
      await applyOrderPayment(order.id, { paymentStatus: "expired" }).catch(() => false);
    }
    return <Expired order={order} />;
  }

  // awaiting_payment with no session — buildSessionInput or the gateway failed. `paymentError`
  // holds PayMongo's wording, which paymongo.ts documents must never reach a customer.
  if (!order.checkoutUrl) return <Unavailable order={order} />;

  return <Ready order={order} />;
}

function confirmedHref(order: Order): string {
  return `/checkout/confirmed?ref=${encodeURIComponent(order.ref)}&o=${encodeURIComponent(order.id)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl text-center">{children}</div>
    </Container>
  );
}

function Badge({ tone = "brand" }: { tone?: "brand" | "danger" }) {
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
        tone === "danger" ? "bg-danger/10" : "bg-brand-50"
      }`}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        className={tone === "danger" ? "text-danger" : "text-brand-600"}
        aria-hidden="true"
      >
        {tone === "danger" ? (
          <path d="M12 7v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path
            d="M3 10h18M7 15h4M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}

function RefPill({ orderRef }: { orderRef: string }) {
  return (
    <p className="mt-4 inline-block rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted">
      Reference{" "}
      <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-wide text-fg">
        {orderRef}
      </span>
    </p>
  );
}

/** No cookie, or it points at an order that no longer exists. 200, not 404 — this is legitimate. */
function NoPendingPayment() {
  return (
    <Shell>
      <ClearPendingPayment />
      <Badge />
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
        No payment in progress
      </h1>
      <p className="mt-5 leading-relaxed text-muted">
        There&apos;s nothing waiting to be paid. If you were part-way through an order, its payment
        link may have expired — your cart is still saved, so you can check out again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/cart" size="lg">
          Go to cart
        </LinkButton>
        <LinkButton href="/contact" variant="secondary" size="lg">
          Contact us
        </LinkButton>
      </div>
    </Shell>
  );
}

function Expired({ order }: { order: Order }) {
  return (
    <Shell>
      {/* The cart is deliberately NOT cleared — they can check out again immediately. */}
      <ClearPendingPayment />
      <Badge tone="danger" />
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
        This payment link expired
      </h1>
      <RefPill orderRef={order.ref} />
      <p className="mt-5 leading-relaxed text-muted">
        Payment links stay valid for {PAY_WINDOW_MINUTES} minutes. Nothing was charged, and your
        cart is still here — check out again and we&apos;ll re-check prices and stock for you.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/checkout" size="lg">
          Back to checkout
        </LinkButton>
        <LinkButton href="/contact" variant="secondary" size="lg">
          Contact us
        </LinkButton>
      </div>
    </Shell>
  );
}

function Unavailable({ order }: { order: Order }) {
  return (
    <Shell>
      <ClearPendingPayment />
      <Badge tone="danger" />
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
        We couldn&apos;t start your payment
      </h1>
      <RefPill orderRef={order.ref} />
      <p className="mt-5 leading-relaxed text-muted">
        Nothing was charged. We have your order details — try checking out again, or email us and
        quote your reference and we&apos;ll sort it out.
      </p>
      <p className="mt-3 text-sm text-muted">Email {SITE.email} and quote your reference.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/checkout" size="lg">
          Back to checkout
        </LinkButton>
        <LinkButton href="/contact" variant="secondary" size="lg">
          Contact us
        </LinkButton>
      </div>
    </Shell>
  );
}

/**
 * The main event. Also serves a `failed` order, framed as a retry: PayMongo's hosted page lets a
 * customer pick a different method after a decline, and `applyOrderPayment` blesses `failed → paid`
 * for exactly that reason. Sending them back to build a duplicate order would waste the point of
 * offering five methods.
 */
function Ready({ order }: { order: Order }) {
  const retry = order.paymentStatus === "failed";

  return (
    <Shell>
      {/* No ClearCart here — the cart must survive until payment is actually confirmed. */}
      <Badge />
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
        {retry ? "Try that payment again" : "One step left"}
      </h1>
      <RefPill orderRef={order.ref} />

      {retry && (
        <p className="mx-auto mt-4 max-w-md rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">
          Your last attempt didn&apos;t go through and nothing was charged. You can try again, or
          pick a different payment method.
        </p>
      )}

      <dl className="mx-auto mt-6 max-w-xs space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
          </dt>
          <dd className="font-medium text-fg">{formatPHP(order.subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd className="font-medium text-fg">
            {order.shippingFee === 0 ? "Free" : formatPHP(order.shippingFee)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <dt className="font-semibold text-fg">Total</dt>
          <dd className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            {formatPHP(order.total)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-light">
        These are the final amounts — prices and shipping were re-checked when you placed the order.
      </p>

      <form action={continueToPaymentAction} className="mt-7">
        <input type="hidden" name="o" value={order.id} />
        <SubmitButton size="lg" pendingLabel="Taking you to PayMongo…">
          Continue to payment
        </SubmitButton>
      </form>

      <p className="mt-4 text-xs text-muted-light">
        Pay with {PAYMENT_METHOD_TYPES.map((t) => PAYMENT_METHOD_LABELS[t]).join(" · ")}
      </p>
      <p className="mt-2 text-xs text-muted-light">
        Nothing has been charged yet.{" "}
        <PayWindowCountdown
          exp={order.checkoutExpiresAt}
          fallback={`This link stays valid for ${PAY_WINDOW_MINUTES} minutes.`}
        />
      </p>

      <div className="mt-8">
        <LinkButton href="/cart" variant="secondary">
          Back to cart
        </LinkButton>
      </div>
    </Shell>
  );
}
