import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { AccountShell, AccountShellLink } from "@/components/account/AccountShell";
import { readPendingVerifyEmail } from "@/lib/customer-auth";
import { ResendVerification } from "./ResendVerification";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/verify" },
};

/**
 * The "check your inbox" screen, reached after registering and after an unverified sign-in attempt.
 *
 * This page used to send people back to sign in again for a fresh link, on the reasoning that
 * Firebase will only send a verification email for an idToken and an idToken needs a password — so
 * a resend driven by a typed-in email address would either not work or would let a stranger spam
 * someone's inbox. That reasoning still holds, and the resend here does not break it: it takes NO
 * input, reads whose account to mail from the httpOnly cookie set when they registered, and mints
 * its own idToken from the uid. Nothing a visitor can type reaches it. See
 * `resendVerificationAction`.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ resent?: string }>;
}) {
  const { resent } = await searchParams;
  const email = await readPendingVerifyEmail();

  return (
    <AccountShell
      title={resent === "1" ? "Confirm your email first" : "Confirm your email"}
      subtitle={
        email
          ? `We sent a confirmation link to ${email}.`
          : "We sent you a confirmation link."
      }
      footer={
        <>
          Wrong address?{" "}
          <AccountShellLink href="/account/register">Register again</AccountShellLink>
        </>
      }
    >
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-brand-600"
            aria-hidden="true"
          >
            <path
              d="M3 7l9 6 9-6M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          {resent === "1"
            ? "Your account isn't confirmed yet, so we've sent a new link. Open it, then come back and sign in."
            : "Open the link in that email to activate your account, then sign in."}
        </p>

        <LinkButton href="/account/login" size="lg" className="mt-6 w-full">
          Back to sign in
        </LinkButton>

        <ResendVerification />
      </div>
    </AccountShell>
  );
}
