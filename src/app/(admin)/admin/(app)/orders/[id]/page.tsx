import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { isPayWindowOpen } from "@/lib/pay-window";
import { formatPHP } from "@/lib/format";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { orderTone, paymentTone } from "../tone";
import { OrderControls } from "./OrderControls";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const name = `${order.customer.firstName} ${order.customer.lastName}`.trim();
  const address = [
    [order.shipping.address, order.shipping.apartment].filter(Boolean).join(", "),
    [order.shipping.barangay, order.shipping.city].filter(Boolean).join(", "),
    [order.shipping.region, order.shipping.postal].filter(Boolean).join(" "),
    order.shipping.country,
  ].filter((line) => line.trim());

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
          {order.ref}
        </h1>
        <StatusBadge label={order.status} tone={orderTone(order.status)} />
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
          tone={paymentTone(order.paymentStatus)}
        />
      </div>
      <p className="mt-2 text-muted">Placed {formatWhen(order.createdAt)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Line items */}
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-4 font-semibold text-fg">
              {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            </h2>
            <ul className="divide-y divide-line">
              {order.lines.map((line) => (
                <li key={`${line.source}:${line.id}`} className="flex items-center gap-4 px-5 py-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                    {line.image && (
                      <Image
                        src={line.image}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={line.href} target="_blank" className="font-medium text-fg hover:text-brand-700">
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {line.sku && <span className="font-mono text-xs">{line.sku}</span>}
                      {line.sku && " · "}
                      {line.quantity} × {formatPHP(line.price)}
                      {line.unit && ` / ${line.unit}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-fg">{formatPHP(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-line px-5 py-4 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted">Subtotal</dt>
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
            <p className="border-t border-line bg-bg px-5 py-3 text-xs text-muted">
              Prices were re-read from the catalog when the order was placed. VAT is not itemised.
            </p>
          </section>

          <OrderControls
            id={order.id}
            status={order.status}
            note={order.note}
            paymentStatus={order.paymentStatus}
            hasSession={Boolean(order.checkoutSessionId)}
          />
        </div>

        {/* Payment + customer + delivery */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-fg">Payment</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted-light">Status</dt>
                <dd className="font-medium text-fg">
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-light">Method</dt>
                <dd className="font-medium text-fg">
                  {order.paymentMethod === "manual"
                    ? "Recorded offline"
                    : order.paymentMethod || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-light">Paid</dt>
                <dd className="font-medium text-fg">{formatWhen(order.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-light">Payment window</dt>
                {/* formatWhen renders "—" for 0, so orders predating the window read correctly. */}
                <dd className="font-medium text-fg">{formatWhen(order.checkoutExpiresAt)}</dd>
              </div>
              {order.checkoutSessionId && (
                <div>
                  <dt className="text-muted-light">PayMongo session</dt>
                  {/* Quoted verbatim in support tickets — keep it selectable and monospaced. */}
                  <dd className="break-all font-mono text-xs text-muted">
                    {order.checkoutSessionId}
                  </dd>
                </div>
              )}
            </dl>

            {/* The session already exists, so re-sending its link costs nothing and is the
                fastest way to rescue an abandoned checkout — but only while the window is open.
                Without this branch staff have no way to tell a live link from a dead one, and
                sending a dead one is a support ticket that looks like a bug. */}
            {order.paymentStatus === "awaiting_payment" && order.checkoutUrl && (
              <p className="mt-4 border-t border-line pt-4 text-xs">
                <span className="text-muted-light">Payment link</span>
                <a
                  href={order.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-1 block break-all font-medium hover:underline ${
                    isPayWindowOpen(order.checkoutExpiresAt)
                      ? "text-brand-700"
                      : "text-muted-light line-through"
                  }`}
                >
                  {order.checkoutUrl}
                </a>
              </p>
            )}

            {order.checkoutUrl &&
              order.paymentStatus !== "paid" &&
              !isPayWindowOpen(order.checkoutExpiresAt) && (
                <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
                  This link&apos;s payment window lapsed {formatWhen(order.checkoutExpiresAt)} and
                  it has most likely been expired at PayMongo. Don&apos;t send it — ask the
                  customer to place a new order so prices and stock are re-checked.
                </p>
              )}

            {order.paymentError && (
              <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
                {order.paymentError}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-fg">Customer</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted-light">Name</dt>
                <dd className="font-medium text-fg">{name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-light">Email</dt>
                <dd>
                  <a
                    href={`mailto:${order.customer.email}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {order.customer.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-light">Phone</dt>
                <dd>
                  <a
                    href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {order.customer.phone || "—"}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-fg">Deliver to</h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic leading-relaxed text-muted">
              {address.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </address>
          </section>
        </aside>
      </div>
    </div>
  );
}
