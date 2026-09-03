import Link from "next/link";
import { formatPHP } from "@/lib/format";
import { addressLines, type SavedAddress } from "@/lib/addresses";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/payment-status";
import { INQUIRY_STATUS_LABELS } from "@/lib/inquiry-status";
import type { Order } from "@/lib/orders";
import type { Inquiry } from "@/lib/inquiries";

/**
 * The read-only panels on /account: orders, inquiries, addresses.
 *
 * Server components — they only render data the page already fetched, and pulling the server-only
 * `orders`/`inquiries` types is fine here because nothing in this file crosses to the client.
 */

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(epochMs: number): string {
  return epochMs ? dateFmt.format(new Date(epochMs)) : "—";
}

export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 text-sm font-medium text-muted">({count})</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
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

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "plain" }) {
  const styles = {
    ok: "bg-success/10 text-success",
    warn: "bg-brand-50 text-brand-700",
    bad: "bg-danger/10 text-danger",
    plain: "bg-elevated text-muted",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{label}</span>
  );
}

function paymentTone(status: PaymentStatus): "ok" | "warn" | "bad" | "plain" {
  if (status === "paid") return "ok";
  if (status === "failed" || status === "expired") return "bad";
  return "warn"; // awaiting_payment — the one the customer can still act on
}

function orderTone(status: OrderStatus): "ok" | "warn" | "bad" | "plain" {
  if (status === "delivered") return "ok";
  if (status === "cancelled") return "bad";
  return "plain";
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

export function OrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
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

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((order) => (
        <li
          key={order.id}
          className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-fg">
                {order.ref}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatDate(order.createdAt)} · {order.itemCount}{" "}
                {order.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
                tone={paymentTone(order.paymentStatus)}
              />
              <StatusPill label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
            </div>
          </div>

          <ul className="mt-3 border-t border-line pt-3 text-sm">
            {order.lines.slice(0, 3).map((line) => (
              <li key={`${line.source}:${line.id}`} className="flex justify-between gap-4 py-0.5">
                <Link
                  href={line.href}
                  className="min-w-0 truncate text-muted hover:text-brand-700"
                >
                  {line.quantity}× {line.name}
                </Link>
                <span className="shrink-0 text-muted">{formatPHP(line.lineTotal)}</span>
              </li>
            ))}
            {order.lines.length > 3 && (
              <li className="py-0.5 text-xs text-muted-light">
                + {order.lines.length - 3} more
              </li>
            )}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-muted">Total</span>
            <span className="text-base font-bold text-fg">{formatPHP(order.total)}</span>
          </div>

          {/* The one action a customer can still take on their own order. */}
          {order.paymentStatus === "awaiting_payment" && order.checkoutUrl && (
            <Link
              href="/checkout/pay"
              prefetch={false}
              className="mt-3 block rounded-lg bg-brand-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Finish payment
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inquiries
// ─────────────────────────────────────────────────────────────────────────────

export function InquiryList({ inquiries }: { inquiries: Inquiry[] }) {
  if (inquiries.length === 0) {
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

  return (
    <ul className="flex flex-col gap-3">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-fg">
                {inquiry.ref}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(inquiry.createdAt)}</p>
            </div>
            <StatusPill
              label={INQUIRY_STATUS_LABELS[inquiry.status]}
              tone={inquiry.status === "closed" ? "ok" : "plain"}
            />
          </div>

          {inquiry.product && (
            <p className="mt-2 text-sm">
              <span className="text-muted">About: </span>
              <Link
                href={inquiry.product.href}
                className="font-medium text-brand-700 hover:text-brand-800"
              >
                {inquiry.product.name}
              </Link>
            </p>
          )}

          {/* Their own words, clamped — the full thread lives with sales, not here. */}
          <p className="mt-2 line-clamp-3 whitespace-pre-line border-t border-line pt-3 text-sm leading-relaxed text-muted">
            {inquiry.message}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Addresses
// ─────────────────────────────────────────────────────────────────────────────

export function AddressList({ addresses }: { addresses: SavedAddress[] }) {
  if (addresses.length === 0) {
    return <Empty>Addresses you deliver to will appear here after your first order.</Empty>;
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.key} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <address className="text-sm not-italic leading-relaxed text-fg">
              {addressLines(address.shipping).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-2 text-xs text-muted">
              Last used {formatDate(address.lastUsedAt)}
              {address.timesUsed > 1 && ` · ${address.timesUsed} orders`}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-light">
        These are the addresses from your past orders. You can enter a different one at checkout.
      </p>
    </>
  );
}
