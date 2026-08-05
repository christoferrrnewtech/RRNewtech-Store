import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { formatPHP } from "@/lib/format";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { orderTone } from "../tone";
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
            <div className="flex items-baseline justify-between border-t border-line px-5 py-4">
              <span className="font-semibold text-fg">Subtotal</span>
              <span className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
                {formatPHP(order.subtotal)}
              </span>
            </div>
            <p className="border-t border-line bg-bg px-5 py-3 text-xs text-muted">
              Prices were re-read from the catalog when the order was placed. Shipping and VAT are
              not included.
            </p>
          </section>

          <OrderControls id={order.id} status={order.status} note={order.note} />
        </div>

        {/* Customer + delivery */}
        <aside className="space-y-6">
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
