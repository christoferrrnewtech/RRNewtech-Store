import Link from "next/link";
import { formatPHP } from "@/lib/format";
import { addressLines } from "@/lib/addresses";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/payment-status";
import { INQUIRY_KIND_LABELS, INQUIRY_STATUS_LABELS } from "@/lib/inquiry-status";
import type { Order } from "@/lib/orders";
import type { Inquiry } from "@/lib/inquiries";
import { isCustomerCancellable } from "@/lib/order-status";
import { isPayMongoConfigured } from "@/lib/paymongo";
import { canRenewPayment, isPayWindowOpen } from "@/lib/pay-window";
import { TabLink } from "./AccountDashboard";
import { CancelOrderButton } from "./CancelOrderButton";

/**
 * The read-only panels on /account: overview, orders and inquiries.
 *
 * Addresses are NOT here — they are editable now, so they live in the client component
 * `AddressBook.tsx` beside this file.
 *
 * Server components — they only render data the page already fetched, and pulling the server-only
 * `orders`/`inquiries` types is fine here because nothing in this file crosses to the client.
 * (`TabLink` is a client component, but it is only handed strings and server-rendered children.)
 *
 * Orders and inquiries are one row each, opened with a native `<details>` — a long history then
 * scans as a list instead of a wall of cards, and expanding a row needs no client JavaScript.
 */

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(epochMs: number): string {
  return epochMs ? dateFmt.format(new Date(epochMs)) : "—";
}

/** How many rows of each kind the overview previews before "View all". */
const PREVIEW = 3;

/**
 * Can the customer still pay for this order from here?
 *
 * Either its link is live, or it lapsed recently enough for `/checkout/pay` to offer a new one
 * (`canRenewPayment`). Without PayMongo there is nothing to pay through — those orders are
 * settled by the team directly.
 */
function isPayable(order: Order): boolean {
  if (order.paymentStatus === "paid" || order.status === "cancelled") return false;
  if (!isPayMongoConfigured()) return false;
  const live =
    order.checkoutUrl !== "" &&
    order.paymentStatus !== "expired" &&
    isPayWindowOpen(order.checkoutExpiresAt);
  return live || canRenewPayment(order.createdAt);
}

/** Orders the customer can still pay for — the main thing on the page they can act on. */
export function payableOrders(orders: Order[]): Order[] {
  return orders.filter(isPayable);
}

/** One line on why the order is waiting, for the strip that carries its buttons. */
function paymentPrompt(order: Order): string {
  if (order.paymentStatus === "failed") return "Your last payment attempt didn't go through";
  if (order.paymentStatus === "expired" || !isPayWindowOpen(order.checkoutExpiresAt)) {
    return "Payment link expired. You can still pay for this order";
  }
  return "Payment not completed yet";
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Shared empty state, so every panel says "nothing here yet" the same way. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

/**
 * Shown when a panel's query fails rather than letting it take the whole page down.
 *
 * The realistic cause is a missing composite index (see firestore.indexes.json) — Firestore fails
 * such a query outright rather than falling back to a scan, so an un-deployed index would otherwise
 * turn the entire account page into a 500.
 */
export function Unavailable({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-8 text-center text-sm text-muted">
      We couldn&apos;t load your {what} just now. Please try again shortly.
    </div>
  );
}

type Tone = "ok" | "warn" | "bad" | "plain";

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const styles = {
    ok: "bg-success/10 text-success",
    warn: "bg-brand-50 text-brand-700",
    bad: "bg-danger/10 text-danger",
    plain: "bg-elevated text-muted",
  }[tone];
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function paymentTone(status: PaymentStatus): Tone {
  if (status === "paid") return "ok";
  if (status === "failed" || status === "expired") return "bad";
  return "warn"; // awaiting_payment — the one the customer can still act on
}

function orderTone(status: OrderStatus): Tone {
  if (status === "delivered") return "ok";
  if (status === "cancelled") return "bad";
  return "plain";
}

function OrderPills({ order }: { order: Order }) {
  // A cancelled order that never took money has nothing more to say about payment.
  if (order.status === "cancelled" && order.paymentStatus !== "paid") {
    return <StatusPill label={ORDER_STATUS_LABELS.cancelled} tone="bad" />;
  }
  return (
    <>
      <StatusPill
        label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
        tone={paymentTone(order.paymentStatus)}
      />
      <StatusPill label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
    </>
  );
}

function InquiryPill({ inquiry }: { inquiry: Inquiry }) {
  return (
    <StatusPill
      label={INQUIRY_STATUS_LABELS[inquiry.status]}
      tone={inquiry.status === "closed" ? "ok" : "plain"}
    />
  );
}

/** What an inquiry is about, in one line: the product if there is one, else its opening words. */
function inquirySubject(inquiry: Inquiry): string {
  return inquiry.product?.name ?? inquiry.message.split("\n")[0];
}

/** The frame a list of rows sits in: one card, rows divided by rules. */
function RowList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {children}
    </ul>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className="size-4 shrink-0 text-muted-light transition-transform group-open:rotate-180"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const summaryClass =
  "flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-elevated/60 sm:px-5 [&::-webkit-details-marker]:hidden";

const refClass =
  "font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-fg";

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────

export function Overview({
  details,
  orders,
  inquiries,
}: {
  details: React.ReactNode;
  orders: Order[] | null;
  inquiries: Inquiry[] | null;
}) {
  const unpaid = orders ? payableOrders(orders) : [];

  return (
    <div className="flex flex-col gap-8">
      {unpaid.length > 0 && (
        <section
          aria-label="Needs your attention"
          className="rounded-2xl border border-warn/30 bg-accent-light p-4 sm:p-5"
        >
          <p className="text-sm font-semibold text-fg">
            {unpaid.length === 1
              ? "1 order is waiting for payment"
              : `${unpaid.length} orders are waiting for payment`}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {unpaid.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className={refClass}>{order.ref}</p>
                  <p className="text-xs text-muted">
                    {formatDate(order.createdAt)} · {formatPHP(order.total)}
                  </p>
                </div>
                <OrderActions order={order} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <PanelHeader
            title="Recent orders"
            action={orders && orders.length > PREVIEW && <ViewAll tab="orders">All orders</ViewAll>}
          />
          {!orders ? (
            <Unavailable what="orders" />
          ) : orders.length === 0 ? (
            <NoOrders />
          ) : (
            <RowList>
              {orders.slice(0, PREVIEW).map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className={refClass}>{order.ref}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(order.createdAt)}</p>
                  </div>
                  <StatusPill
                    label={ORDER_STATUS_LABELS[order.status]}
                    tone={orderTone(order.status)}
                  />
                  <span className="min-w-20 shrink-0 text-right text-sm font-bold text-fg">
                    {formatPHP(order.total)}
                  </span>
                </li>
              ))}
            </RowList>
          )}
        </section>

        <section>
          <PanelHeader
            title="Recent inquiries"
            action={
              inquiries &&
              inquiries.length > PREVIEW && <ViewAll tab="inquiries">All inquiries</ViewAll>
            }
          />
          {!inquiries ? (
            <Unavailable what="inquiries" />
          ) : inquiries.length === 0 ? (
            <NoInquiries />
          ) : (
            <RowList>
              {inquiries.slice(0, PREVIEW).map((inquiry) => (
                <li key={inquiry.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">
                      {inquirySubject(inquiry)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {inquiry.ref} · {formatDate(inquiry.createdAt)}
                    </p>
                  </div>
                  <InquiryPill inquiry={inquiry} />
                </li>
              ))}
            </RowList>
          )}
        </section>
      </div>

      <section>
        <PanelHeader title="Your details" />
        {details}
      </section>
    </div>
  );
}

function ViewAll({ tab, children }: { tab: "orders" | "inquiries"; children: React.ReactNode }) {
  return (
    <TabLink tab={tab} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
      {children} →
    </TabLink>
  );
}

/**
 * Finish payment and/or Cancel order, whichever apply.
 *
 * The pay link carries the order id. Without it `/checkout/pay` falls back to the resume cookie,
 * which points at the customer's LATEST checkout — so with two unpaid orders, both buttons would
 * open the same one.
 */
function OrderActions({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      {isCustomerCancellable(order) && <CancelOrderButton orderId={order.id} orderRef={order.ref} />}
      {isPayable(order) && <FinishPayment orderId={order.id} />}
    </div>
  );
}

function FinishPayment({ orderId }: { orderId: string }) {
  return (
    <Link
      href={`/checkout/pay?o=${encodeURIComponent(orderId)}`}
      prefetch={false}
      className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
    >
      Finish payment
    </Link>
  );
}

function NoOrders() {
  return (
    <Empty>
      You haven&apos;t placed an order yet.{" "}
      <Link href="/" className="font-semibold text-brand-700 hover:text-brand-800">
        Start shopping
      </Link>
      .
    </Empty>
  );
}

function NoInquiries() {
  return (
    <Empty>
      No inquiries yet.{" "}
      <Link href="/contact" className="font-semibold text-brand-700 hover:text-brand-800">
        Ask our sales team
      </Link>
      .
    </Empty>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

export function OrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <NoOrders />;

  return (
    <RowList>
      {orders.map((order) => (
        <li key={order.id}>
          <details className="group">
            <summary className={summaryClass}>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:w-40 sm:shrink-0">
                  <p className={refClass}>{order.ref}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(order.createdAt)} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  <OrderPills order={order} />
                </div>
              </div>
              <span className="shrink-0 text-right text-sm font-bold text-fg">
                {formatPHP(order.total)}
              </span>
              <Chevron />
            </summary>

            <div className="grid grid-cols-1 gap-5 border-t border-line bg-bg/60 px-4 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_14rem] sm:px-5">
              <div>
                <ul className="flex flex-col gap-1">
                  {order.lines.map((line) => (
                    <li key={`${line.source}:${line.id}`} className="flex justify-between gap-4">
                      <Link
                        href={line.href}
                        className="min-w-0 truncate text-fg hover:text-brand-700"
                      >
                        <span className="text-muted">{line.quantity}×</span> {line.name}
                      </Link>
                      <span className="shrink-0 text-muted">{formatPHP(line.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
                  <div className="flex justify-between text-muted">
                    <dt>Subtotal</dt>
                    <dd>{formatPHP(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-muted">
                    <dt>Shipping</dt>
                    <dd>{order.shippingFee > 0 ? formatPHP(order.shippingFee) : "Free"}</dd>
                  </div>
                  <div className="flex justify-between font-bold text-fg">
                    <dt>Total</dt>
                    <dd>{formatPHP(order.total)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-light">
                  Ship to
                </p>
                <address className="mt-1 not-italic leading-relaxed text-muted">
                  <span className="block font-medium text-fg">
                    {`${order.customer.firstName} ${order.customer.lastName}`.trim()}
                  </span>
                  {addressLines(order.shipping).map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>
          </details>

          {/* Outside the <details>: the actions a customer can still take on their own order
              shouldn't hide behind a click, and a link can't live inside a <summary>. */}
          {(isPayable(order) || isCustomerCancellable(order)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line bg-accent-light/60 px-4 py-2.5 sm:px-5">
              <span className="text-xs font-medium text-fg">
                {isPayable(order) ? paymentPrompt(order) : "Not paid"}
              </span>
              <OrderActions order={order} />
            </div>
          )}
        </li>
      ))}
    </RowList>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inquiries
// ─────────────────────────────────────────────────────────────────────────────

export function InquiryList({ inquiries }: { inquiries: Inquiry[] }) {
  if (inquiries.length === 0) return <NoInquiries />;

  return (
    <RowList>
      {inquiries.map((inquiry) => (
        <li key={inquiry.id}>
          <details className="group">
            <summary className={summaryClass}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{inquirySubject(inquiry)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {INQUIRY_KIND_LABELS[inquiry.kind]} · {inquiry.ref} ·{" "}
                  {formatDate(inquiry.createdAt)}
                </p>
              </div>
              <InquiryPill inquiry={inquiry} />
              <Chevron />
            </summary>

            <div className="border-t border-line bg-bg/60 px-4 py-4 text-sm sm:px-5">
              {inquiry.product && (
                <p>
                  <span className="text-muted">About: </span>
                  <Link
                    href={inquiry.product.href}
                    className="font-medium text-brand-700 hover:text-brand-800"
                  >
                    {inquiry.product.name}
                  </Link>
                </p>
              )}
              {inquiry.clinic && (
                <p className="mt-1">
                  <span className="text-muted">For: </span>
                  <span className="text-fg">{inquiry.clinic}</span>
                </p>
              )}
              {/* Their own words. The full thread lives with sales, not here. */}
              <p
                className={`whitespace-pre-line leading-relaxed text-muted ${
                  inquiry.product || inquiry.clinic ? "mt-3 border-t border-line pt-3" : ""
                }`}
              >
                {inquiry.message}
              </p>
            </div>
          </details>
        </li>
      ))}
    </RowList>
  );
}
