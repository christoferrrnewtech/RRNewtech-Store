"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resendVerificationAction } from "@/app/(store)/account/actions";
import { FormMessage } from "@/components/ui/FormControls";
import type { ActionState } from "@/lib/form-data";

/**
 * "Didn't get the email?" — the one-click resend.
 *
 * A form with no fields, deliberately. The action takes no input at all and reads whose account to
 * mail from the httpOnly cookie set at registration, which is what makes a button safe here where
 * an email box would not be: there is nothing to point at someone else's inbox, and nothing that
 * reveals whether a given address is registered. See `resendVerificationAction`.
 *
 * The trigger is a real `<button>` styled as inline text rather than a link, because it performs an
 * action instead of going somewhere — a screen reader should announce it as a button, and it must
 * not be something a browser can prefetch or a crawler can follow.
 */
export function ResendVerification() {
  const [state, resend] = useActionState<ActionState, FormData>(resendVerificationAction, {});

  return (
    <form action={resend} className="mt-4 flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted">
        Didn&apos;t get the email? <ResendButton /> and we&apos;ll resend the email verification
        link. It can take a minute to arrive — check your spam or junk folder too, as it sometimes
        lands there.
      </p>

      <FormMessage state={state} />
    </form>
  );
}

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
    >
      {pending ? "Sending…" : "Click here"}
    </button>
  );
}
