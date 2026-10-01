import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { canRenewPayment, isPayWindowOpen } from "@/lib/pay-window";
import { formatPHP } from "@/lib/format";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { DetailList, PageHeader, Panel } from "@/components/admin/Panel";
import { orderTone, paymentTone } from "../tone";
import { FulfilmentControl, NoteControl, PaymentActions } from "./OrderControls";

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

  const lapsed =
    order.checkoutUrl !== "" &&
    order.paymentStatus !== "paid" &&
    !isPayWindowOpen(order.checkoutExpiresAt);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/orders", label: "All orders" }}
        title={order.ref}
        badges={
          <>
            <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
            <StatusBadge
              label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
              tone={paymentTone(order.paymentStatus)}
            />
          </>
        }
        description={`Placed ${formatWhen(order.createdAt)}${name ? ` by ${name}` : ""}`}
        actions={
          order.customer.email && (
            <a
              href={`mailto:${order.customer.email}?subject=${encodeURIComponent(`Your order ${order.ref}`)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
            >
              Email customer
            </a>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={`${order.itemCount} item${order.itemCount === 1 ? "" : "s"}`}
            padded={false}
            footer={
              <p className="text-xs text-muted">
                Prices were re-read from the catalog when the order was placed. VAT is not
                itemised.
              </p>
            }
          >
            <ul className="divide-y divide-line">
              {order.lines.map((line) => (
                <li
                  key={`${line.source}:${line.id}`}
                  className="flex items-center gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                    {line.image && (
                      <Image src={line.image} alt="" fill sizes="56px" className="object-contain p-1" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={line.href}
                      target="_blank"
                      className="font-medium text-fg hover:text-brand-700"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {line.quantity} × {formatPHP(line.price)}
                      {line.unit && ` / ${line.unit}`}
                      {line.sku && (
                        <span className="ml-2 font-mono text-xs text-muted-light">{line.sku}</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-fg">{formatPHP(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-line px-5 py-4 text-sm sm:px-6">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-medium text-fg">{formatPHP(order.subtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Shipping charged</dt>
                <dd className="text-right font-medium text-fg">
                  {order.shippingFee > 0 ? formatPHP(order.shippingFee) : "Free (over threshold)"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
                  {formatPHP(order.total)}
                </dd>
              </div>
            </dl>
          </Panel>

          <FulfilmentControl id={order.id} status={order.status} />
          <NoteControl id={order.id} note={order.note} />
        </div>

        <aside className="space-y-6">
          <Panel
            title="Payment"
            actions={
              <StatusBadge
                label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
                tone={paymentTone(order.paymentStatus)}
              />
            }
          >
            <DetailList
              items={[
                {
                  label: "Method",
                  value:
                    order.paymentMethod === "manual"
                      ? "Recorded offline"
                      : order.paymentMethod || "—",
                },
                { label: "Paid", value: formatWhen(order.paidAt) },
                // formatWhen renders "—" for 0, so orders predating the window read correctly.
                { label: "Payment window ends", value: formatWhen(order.checkoutExpiresAt) },
                {
                  label: "PayMongo session",
                  hidden: !order.checkoutSessionId,
                  // Quoted verbatim in support tickets — keep it selectable and monospaced.
                  value: (
                    <span className="break-all font-mono text-xs text-muted">
                      {order.checkoutSessionId}
                    </span>
                  ),
                },
              ]}
            />

            {/* The session already exists, so re-sending its link costs nothing and is the
                fastest way to rescue an abandoned checkout — but only while the window is open.
                Without this branch staff have no way to tell a live link from a dead one, and
                sending a dead one is a support ticket that looks like a bug. */}
            {order.paymentStatus === "awaiting_payment" && order.checkoutUrl && !lapsed && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-medium text-muted">Payment link</p>
                <a
                  href={order.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs font-medium text-brand-700 hover:underline"
                >
                  {order.checkoutUrl}
                </a>
              </div>
            )}

            {lapsed && (
              <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
                The payment link expired {formatWhen(order.checkoutExpiresAt)}. Don&apos;t send it.
                {canRenewPayment(order.createdAt)
                  ? " The customer can get a fresh link for this order from their account, or from the payment page."
                  : " The order is too old to renew, so ask the customer to check out again — prices and stock are re-checked."}
              </p>
            )}

            {order.paymentError && (
              <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
                {order.paymentError}
              </p>
            )}

            {/* Only while there is something to resolve — a paid order needs neither control. */}
            {order.paymentStatus !== "paid" && (
              <div className="mt-5 border-t border-line pt-4">
                <PaymentActions id={order.id} hasSession={Boolean(order.checkoutSessionId)} />
              </div>
            )}
          </Panel>

          <Panel title="Customer">
            <DetailList
              items={[
                { label: "Name", value: name || "—" },
                {
                  label: "Email",
                  value: order.customer.email ? (
                    <a
                      href={`mailto:${order.customer.email}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {order.customer.email}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Phone",
                  value: order.customer.phone ? (
                    <a
                      href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {order.customer.phone}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Deliver to",
                  value: (
                    <address className="not-italic leading-relaxed text-muted">
                      {address.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  ),
                },
                {
                  label: "Account",
                  value: order.customer.userId ? "Signed-in customer" : "Guest checkout",
                },
              ]}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
