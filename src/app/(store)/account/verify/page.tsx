import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { AccountShell, AccountShellLink } from "@/components/account/AccountShell";
import { readPendingVerifyEmail } from "@/lib/customer-auth";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/verify" },
};

/**
 * The "check your inbox" screen, reached after registering and after an unverified sign-in attempt.
 *
 * There is no resend button here on purpose. Firebase only sends a verification email for a token
 * from a real sign-in, so a resend endpoint driven by an email address alone would either not work
 * or would let a stranger spam someone's inbox. Signing in again does exactly the right thing —
 * it proves the password and sends a fresh link — so that is where this page points.
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
            : "Open the link in that email to activate your account, then sign in. It can take a minute to arrive — check your spam folder if it doesn't."}
        </p>

        <LinkButton href="/account/login" size="lg" className="mt-6 w-full">
          Back to sign in
        </LinkButton>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Didn&apos;t get the email? Sign in again and we&apos;ll send a fresh link.
        </p>
      </div>
    </AccountShell>
  );
}
