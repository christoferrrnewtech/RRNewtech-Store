"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelOrderAction } from "@/app/(store)/account/order-actions";
import type { ActionState } from "@/lib/form-data";

/**
 * "Cancel order" on /account, with an inline are-you-sure.
 *
 * Two steps rather than `window.confirm`: the confirmation sits where the customer is already
 * looking, names the order, and offers the safe choice first. On success the page revalidates and
 * the row re-renders as cancelled, so this only ever has an error to show.
 */
export function CancelOrderButton({ orderId, orderRef }: { orderId: string; orderRef: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(cancelOrderAction, {});

  return (
    <div className="flex flex-col items-end gap-1.5">
      {confirming ? (
        <form action={action} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="id" value={orderId} />
          <span className="text-xs font-medium text-fg">Cancel {orderRef}?</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-fg hover:bg-elevated"
          >
            Keep order
          </button>
          <ConfirmButton />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          Cancel order
        </button>
      )}
      {state.error && <p className="text-right text-xs text-danger">{state.error}</p>}
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
    >
      {pending ? "Cancelling…" : "Yes, cancel"}
    </button>
  );
}
