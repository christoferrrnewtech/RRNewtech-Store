"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/admin/Form";
import { setInquiryStatusAction, setInquiryNoteAction } from "@/app/(admin)/admin/actions";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/lib/inquiry-status";
import type { ActionState } from "@/lib/form-data";

/** Same two-form split as OrderControls: advance the status, or record what was discussed. */
export function InquiryControls({
  id,
  status,
  note,
}: {
  id: string;
  status: InquiryStatus;
  note: string;
}) {
  const [statusState, statusAction] = useActionState<ActionState, FormData>(
    setInquiryStatusAction,
    {},
  );
  const [noteState, noteAction] = useActionState<ActionState, FormData>(setInquiryNoteAction, {});

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
            {INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INQUIRY_STATUS_LABELS[s]}
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
            placeholder="Quoted ₱12,000 on 5 Aug, following up Friday…"
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
