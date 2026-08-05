import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listOrders, ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
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
import { orderTone } from "./tone";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 50;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; before?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = ORDER_STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;
  const before = Number(params.before) || undefined;

  const orders = await listOrders({ status, before, limit: PAGE_SIZE });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">Orders</h1>
      <p className="mt-2 text-muted">
        Orders placed through checkout. Payment isn&apos;t collected online yet — confirm stock and
        arrange payment with the customer, then move the order along.
      </p>

      <StatusFilter
        basePath="/admin/orders"
        active={status}
        options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
      />

      {orders.length === 0 ? (
        <EmptyQueue>
          {status
            ? `No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders.`
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
              <span className="shrink-0 font-semibold text-fg">{formatPHP(order.subtotal)}</span>
              <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
            </QueueRow>
          ))}
        </QueueList>
      )}

      <QueuePager
        basePath="/admin/orders"
        status={status}
        lastCreatedAt={orders.at(-1)?.createdAt}
        full={orders.length === PAGE_SIZE}
      />
    </div>
  );
}
