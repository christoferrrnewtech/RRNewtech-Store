"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/admin/Form";
import {
  markOrderPaidAction,
  recheckPaymentAction,
  setOrderStatusAction,
  setOrderNoteAction,
} from "@/app/(admin)/admin/actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import type { PaymentStatus } from "@/lib/payment-status";
import type { ActionState } from "@/lib/form-data";

/**
 * The things staff actually do to an order: move it along, write down what happened, and — when
 * the gateway hasn't confirmed — sort the payment out.
 *
 * Separate forms rather than one save button: advancing the status is the frequent action and
 * shouldn't require re-submitting a note that hasn't changed.
 */
export function OrderControls({
  id,
  status,
  note,
  paymentStatus,
  hasSession,
}: {
  id: string;
  status: OrderStatus;
  note: string;
  paymentStatus: PaymentStatus;
  hasSession: boolean;
}) {
  const [statusState, statusAction] = useActionState<ActionState, FormData>(
    setOrderStatusAction,
    {},
  );
  const [noteState, noteAction] = useActionState<ActionState, FormData>(setOrderNoteAction, {});
  const [recheckState, recheckAction] = useActionState<ActionState, FormData>(
    recheckPaymentAction,
    {},
  );
  const [paidState, paidAction] = useActionState<ActionState, FormData>(markOrderPaidAction, {});

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-fg">Status</h2>
        <form action={statusAction} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <SubmitButton>Update status</SubmitButton>
          </div>
          <FormMessage state={statusState} />
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-fg">Internal note</h2>
        <p className="mt-0.5 text-xs text-muted">Only visible here — never shown to the customer.</p>
        <form action={noteAction} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <textarea
            name="note"
            defaultValue={note}
            rows={4}
            placeholder="Stock confirmed, awaiting payment…"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="mt-3">
            <SubmitButton>Save note</SubmitButton>
          </div>
          <FormMessage state={noteState} />
        </form>
      </section>

      {/* Only shown while there is something to resolve — a paid order needs neither control. */}
      {paymentStatus !== "paid" && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
          <h2 className="font-semibold text-fg">Payment</h2>
          <p className="mt-0.5 text-xs text-muted">
            Re-check asks PayMongo what happened — use it if the webhook is down. Marking paid is
            for money that arrived off-platform, and can&apos;t be undone.
          </p>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            {hasSession && (
              <form action={recheckAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton>Re-check payment</SubmitButton>
              </form>
            )}

            <form
              action={paidAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    "Mark this order as paid offline? This is recorded against your account and cannot be undone.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={id} />
              <SubmitButton>Mark as paid offline</SubmitButton>
            </form>
          </div>

          <FormMessage state={recheckState} />
          <FormMessage state={paidState} />
        </section>
      )}
    </div>
  );
}
