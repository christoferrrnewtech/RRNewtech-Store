"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/admin/Form";
import { createJrsShipmentAction } from "@/app/(admin)/admin/actions";
import { formatPHP } from "@/lib/format";
import { formatWhen } from "@/components/admin/Queue";
import type { JrsBooking, JrsShipment } from "@/lib/orders";
import type { ActionState } from "@/lib/form-data";

/**
 * The JRS side of an order: what was quoted at checkout, and the button that books it.
 *
 * The figures here are the COURIER'S, not the customer's. `shippingCost` is what JRS charges us;
 * what the buyer paid is the Shipping line in the totals above, and the two differ on every order
 * over the free-shipping threshold. Labelling them apart matters — someone reconciling the books
 * needs to see both numbers and know which is which.
 *
 * Booking replays the stored payload verbatim; nothing here recalculates anything, which is why
 * the card can show exactly what will be sent before it's sent.
 */
export function JrsShipmentCard({
  id,
  shipment,
  booking,
  paid,
}: {
  id: string;
  shipment: JrsShipment | null;
  booking: JrsBooking | null;
  paid: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createJrsShipmentAction, {});
  const booked = Boolean(booking?.waybillNumber);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold text-fg">Shipping (JRS)</h2>

      {shipment ? (
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-muted-light">Packaging</dt>
            <dd className="font-medium text-fg">
              {shipment.packagingName ?? "General Cargo (JRS rates it)"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-light">Parcel</dt>
            <dd className="font-medium text-fg">
              {shipment.shipmentItems.length} unit
              {shipment.shipmentItems.length === 1 ? "" : "s"} · declared{" "}
              {formatPHP(
                shipment.shipmentItems.reduce((sum, i) => sum + i.declaredValue, 0),
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-light">Rated</dt>
            <dd className="font-medium text-fg">
              {shipment.shipperAddressLine1} → {shipment.recipientAddressLine1}
            </dd>
          </div>
          <div>
            <dt className="text-muted-light">Courier charge</dt>
            <dd className="font-medium text-fg">
              {formatPHP(shipment.shippingCost)}
              {(shipment.insuranceCost > 0 || shipment.valuationCost > 0) && (
                <span className="text-muted">
                  {" "}
                  + {formatPHP(shipment.insuranceCost + shipment.valuationCost)} insurance &amp;
                  valuation
                </span>
              )}
            </dd>
            {/* Said plainly, because the two figures diverging looks like a bug otherwise. */}
            <dd className="mt-0.5 text-xs text-muted">
              What JRS charges us — not what the customer paid.
            </dd>
          </div>
          <div>
            <dt className="text-muted-light">Quoted</dt>
            <dd className="font-medium text-fg">{formatWhen(shipment.quotedAt)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No stored rate — this order was placed before shipments were recorded, or its items had no
          dimensions. Booking will quote JRS once and save the result first.
        </p>
      )}

      {booked ? (
        <div className="mt-4 rounded-lg bg-success/10 px-3 py-2.5">
          <p className="text-xs text-muted">Waybill</p>
          {/* Quoted verbatim into JRS's tracking page and support calls — keep it selectable. */}
          <p className="break-all font-mono text-sm font-semibold text-success">
            {booking?.waybillNumber}
          </p>
          <p className="mt-1 text-xs text-muted">Booked {formatWhen(booking?.bookedAt ?? 0)}</p>
        </div>
      ) : (
        <div className="mt-4 border-t border-line pt-4">
          <form
            action={action}
            onSubmit={(e) => {
              if (
                !confirm(
                  "Create the JRS shipping order? This books a real pickup and can't be undone here.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant={paid ? "primary" : "secondary"}>
              Create shipping order
            </SubmitButton>
          </form>
          {/* Not a block — staff sometimes book ahead of a bank transfer clearing — but the
              default view hides unpaid orders, so landing on one here is worth a second look. */}
          {!paid && (
            <p className="mt-2 text-xs text-warn">This order isn&apos;t marked paid yet.</p>
          )}
        </div>
      )}

      {booking?.error && !booked && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
          Last attempt failed: {booking.error}
        </p>
      )}

      <FormMessage state={state} />
    </section>
  );
}
