"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage, Select, TextArea } from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";
import {
  markOrderPaidAction,
  recheckPaymentAction,
  setOrderStatusAction,
  setOrderNoteAction,
} from "@/app/(admin)/admin/actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import type { ActionState } from "@/lib/form-data";

/**
 * The things staff actually do to an order: move it along, write down what happened, and — when
 * the gateway hasn't confirmed — sort the payment out.
 *
 * Separate forms rather than one save button: advancing the status is the frequent action and
 * shouldn't require re-submitting a note that hasn't changed. Exported as three pieces so the page
 * can put each one beside the information it acts on.
 */

/** The happy path, in order. `cancelled` sits outside it. */
const STEPS: OrderStatus[] = ["new", "confirmed", "packed", "shipped", "delivered"];

export function FulfilmentControl({ id, status }: { id: string; status: OrderStatus }) {
  const [state, action] = useActionState<ActionState, FormData>(setOrderStatusAction, {});
  const reached = STEPS.indexOf(status);
  const cancelled = status === "cancelled";

  return (
    <Panel title="Fulfilment" description="Move the order along as you confirm, pack and ship it.">
      {/* Progress, read-only. The select below is the control — a clickable stepper would make a
          misclick a status change. */}
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Order progress">
        {STEPS.map((step, i) => {
          const done = !cancelled && i <= reached;
          return (
            <li key={step} className="min-w-0">
              <span
                className={`block h-1.5 rounded-full ${done ? "bg-brand-600" : "bg-elevated"}`}
              />
              <span
                className={`mt-2 block truncate text-xs ${
                  i === reached && !cancelled ? "font-semibold text-brand-700" : "text-muted"
                }`}
                aria-current={i === reached && !cancelled ? "step" : undefined}
              >
                {ORDER_STATUS_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          This order was cancelled.
        </p>
      )}

      <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`status-${id}`}>
          Status
        </label>
        <div className="w-full sm:w-56">
          <Select id={`status-${id}`} name="status" defaultValue={status}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton size="sm">Update status</SubmitButton>
        <FormMessage state={state} inline />
      </form>
    </Panel>
  );
}

export function NoteControl({ id, note }: { id: string; note: string }) {
  const [state, action] = useActionState<ActionState, FormData>(setOrderNoteAction, {});

  return (
    <form action={action}>
      <Panel
        title="Internal note"
        description="Only staff see this. It's never shown to the customer."
        footer={
          <>
            <SubmitButton size="sm" variant="secondary">
              Save note
            </SubmitButton>
            <FormMessage state={state} inline />
          </>
        }
      >
        <input type="hidden" name="id" value={id} />
        <TextArea
          name="note"
          defaultValue={note}
          rows={4}
          placeholder="Stock confirmed, awaiting payment…"
          aria-label="Internal note"
        />
      </Panel>
    </form>
  );
}

/**
 * Re-check and mark-as-paid. Only rendered by the page while there is something to resolve.
 *
 * Re-check asks PayMongo what happened — the escape hatch when the webhook is down. Marking paid
 * is for money that arrived off-platform, and can't be undone, hence the confirm.
 */
export function PaymentActions({ id, hasSession }: { id: string; hasSession: boolean }) {
  const [recheckState, recheckAction] = useActionState<ActionState, FormData>(
    recheckPaymentAction,
    {},
  );
  const [paidState, paidAction] = useActionState<ActionState, FormData>(markOrderPaidAction, {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasSession && (
          <form action={recheckAction}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="Checking…">
              Re-check with PayMongo
            </SubmitButton>
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
          <SubmitButton size="sm" variant="secondary">
            Mark as paid offline
          </SubmitButton>
        </form>
      </div>
      <p className="text-xs text-muted">
        Re-check if the webhook may be down. Mark as paid only for money received outside
        PayMongo. It can&apos;t be undone.
      </p>
      <FormMessage state={recheckState} inline />
      <FormMessage state={paidState} inline />
    </div>
  );
}
