"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/admin/Form";
import { setOrderStatusAction, setOrderNoteAction } from "@/app/(admin)/admin/actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import type { ActionState } from "@/lib/form-data";

/**
 * The two things staff actually do to an order: move it along, and write down what happened.
 *
 * Two separate forms rather than one save button — advancing the status is the frequent action and
 * shouldn't require also re-submitting a note that hasn't changed.
 */
export function OrderControls({
  id,
  status,
  note,
}: {
  id: string;
  status: OrderStatus;
  note: string;
}) {
  const [statusState, statusAction] = useActionState<ActionState, FormData>(
    setOrderStatusAction,
    {},
  );
  const [noteState, noteAction] = useActionState<ActionState, FormData>(setOrderNoteAction, {});

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
    </div>
  );
}
