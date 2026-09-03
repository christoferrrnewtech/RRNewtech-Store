import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCustomer } from "@/lib/customer-auth";
import { AccountShell, AccountShellLink } from "@/components/account/AccountShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your R&R Newtech Dental account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/login" },
};

/**
 * `verified=1` is where Firebase's confirmation page sends people back to (the `continueUrl` on the
 * verification email). It is only a hint for the banner below — the authority on whether an address
 * is confirmed is Firebase, re-checked on every sign-in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  if (await getSessionCustomer()) redirect("/account");
  const { verified } = await searchParams;

  return (
    <AccountShell
      title="Sign in"
      subtitle="Access your orders, saved details and faster checkout."
      footer={
        <>
          New to R&amp;R Newtech?{" "}
          <AccountShellLink href="/account/register">Create an account</AccountShellLink>
        </>
      }
    >
      {verified === "1" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-success/10 px-4 py-2.5 text-sm text-success"
        >
          Your email is confirmed. Sign in to finish setting up.
        </p>
      )}
      <LoginForm />
    </AccountShell>
  );
}
