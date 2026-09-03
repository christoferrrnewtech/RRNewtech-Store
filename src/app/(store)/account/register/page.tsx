import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCustomer } from "@/lib/customer-auth";
import { AccountShell, AccountShellLink } from "@/components/account/AccountShell";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Register for an R&R Newtech Dental account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/register" },
};

export default async function RegisterPage() {
  if (await getSessionCustomer()) redirect("/account");

  return (
    <AccountShell
      width="wide"
      title="Create your account"
      subtitle="R&R Newtech supplies licensed dental professionals, so we ask for your PRC ID at sign-up."
      footer={
        <>
          Already have an account?{" "}
          <AccountShellLink href="/account/login">Sign in</AccountShellLink>
        </>
      }
    >
      <RegisterForm />
    </AccountShell>
  );
}
