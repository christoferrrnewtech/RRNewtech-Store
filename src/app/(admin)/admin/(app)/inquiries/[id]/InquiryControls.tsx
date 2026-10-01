"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage, Select, TextArea } from "@/components/admin/Form";
import { Panel } from "@/components/admin/Panel";
import { setInquiryStatusAction, setInquiryNoteAction } from "@/app/(admin)/admin/actions";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/lib/inquiry-status";
import type { ActionState } from "@/lib/form-data";

/** Same split as OrderControls: advance the status, or record what was discussed. */

export function InquiryStatusControl({ id, status }: { id: string; status: InquiryStatus }) {
  const [state, action] = useActionState<ActionState, FormData>(setInquiryStatusAction, {});
  const reached = INQUIRY_STATUSES.indexOf(status);

  return (
    <Panel title="Progress" description="Where this conversation has got to.">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Inquiry progress">
        {INQUIRY_STATUSES.map((step, i) => (
          <li key={step} className="min-w-0">
            <span
              className={`block h-1.5 rounded-full ${i <= reached ? "bg-brand-600" : "bg-elevated"}`}
            />
            <span
              className={`mt-2 block truncate text-xs ${
                i === reached ? "font-semibold text-brand-700" : "text-muted"
              }`}
              aria-current={i === reached ? "step" : undefined}
            >
              {INQUIRY_STATUS_LABELS[step]}
            </span>
          </li>
        ))}
      </ol>

      <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`status-${id}`}>
          Status
        </label>
        <div className="w-full sm:w-56">
          <Select id={`status-${id}`} name="status" defaultValue={status}>
            {INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INQUIRY_STATUS_LABELS[s]}
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

export function InquiryNoteControl({ id, note }: { id: string; note: string }) {
  const [state, action] = useActionState<ActionState, FormData>(setInquiryNoteAction, {});

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
          placeholder="Quoted ₱12,000 on 5 Aug, following up Friday…"
          aria-label="Internal note"
        />
      </Panel>
    </form>
  );
}
