import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import {
  countOrdersByPayment,
  listOrders,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { formatPHP } from "@/lib/format";
import {
  EmptyQueue,
  QueueList,
  QueuePager,
  QueueRow,
  StatusBadge,
  StatusFilter,
  formatWhen,
} from "@/components/admin/Queue";
import { orderTone, paymentTone } from "./tone";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 50;

/**
 * The payment filter defaults to `paid` rather than showing everything.
 *
 * An abandoned checkout still writes an order document — the customer's details are recorded
 * before they're sent to the gateway — so an unfiltered list would bury real work under carts
 * nobody paid for. The count on the "Awaiting payment" chip is the guard against the opposite
 * failure: if the webhook ever breaks, staff would otherwise see an empty screen while money
 * arrives. A non-zero number there is the tell.
 */
const PAYMENT_FILTERS: PaymentStatus[] = ["paid", "awaiting_payment", "failed"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string; before?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = ORDER_STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;
  // "all" is how the chip bar expresses "no payment filter" — absent means the default.
  const payment: PaymentStatus | undefined =
    params.payment === "all"
      ? undefined
      : PAYMENT_FILTERS.includes(params.payment as PaymentStatus)
        ? (params.payment as PaymentStatus)
        : "paid";
  const before = Number(params.before) || undefined;

  const [orders, awaitingCount] = await Promise.all([
    listOrders({ status, paymentStatus: payment, before, limit: PAGE_SIZE }),
    countOrdersByPayment("awaiting_payment"),
  ]);

  // Carried through both filter bars and the pager so picking one never drops the other.
  const active = { status, payment: payment ?? "all" };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">Orders</h1>
      <p className="mt-2 text-muted">
        Orders placed through checkout. Paid orders are shown by default — confirm stock, then move
        the order along. Unpaid ones are abandoned or failed checkouts.
      </p>

      <StatusFilter
        basePath="/admin/orders"
        param="payment"
        active={payment}
        allLabel="All payments"
        preserve={{ status }}
        options={PAYMENT_FILTERS.map((p) => ({
          value: p,
          label:
            p === "awaiting_payment" && awaitingCount > 0
              ? `${PAYMENT_STATUS_LABELS[p]} (${awaitingCount})`
              : PAYMENT_STATUS_LABELS[p],
        }))}
      />

      <StatusFilter
        basePath="/admin/orders"
        active={status}
        preserve={{ payment: active.payment }}
        options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
      />

      {orders.length === 0 ? (
        <EmptyQueue>
          {status || payment
            ? "No orders match these filters."
            : "No orders yet. They'll appear here the moment a customer checks out."}
        </EmptyQueue>
      ) : (
        <QueueList>
          {orders.map((order) => (
            <QueueRow key={order.id} href={`/admin/orders/${order.id}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-fg">
                  {order.customer.firstName} {order.customer.lastName}
                  <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-wide text-muted-light">
                    {order.ref}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                  {order.shipping.city || "—"} · {formatWhen(order.createdAt)}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-fg">{formatPHP(order.total)}</span>
              {/* Only the exception is worth a pill: two badges plus a price overflow the row on a
                  narrow screen, and in the default view every row would say "Paid" anyway. */}
              {order.paymentStatus !== "paid" && (
                <StatusBadge
                  label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  tone={paymentTone(order.paymentStatus)}
                />
              )}
              <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
            </QueueRow>
          ))}
        </QueueList>
      )}

      <QueuePager
        basePath="/admin/orders"
        params={active}
        lastCreatedAt={orders.at(-1)?.createdAt}
        full={orders.length === PAGE_SIZE}
      />
    </div>
  );
}
