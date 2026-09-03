import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { AccountShell } from "@/components/account/AccountShell";
import { logoutCustomerAction } from "@/app/(store)/account/actions";
import { getSessionUser } from "@/lib/auth";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerName } from "@/lib/customers";
import { formatPhone } from "@/lib/customer-fields";

export const metadata: Metadata = {
  title: "Account",
  description: "Your R&R Newtech Dental account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

/**
 * Account overview.
 *
 * Three outcomes, and the order matters. A customer session renders the page. Failing that, a
 * STAFF session goes to /admin — otherwise an admin clicking the header's "Login or Register"
 * would be sent to a login form they had already passed, and round-trip straight back here.
 * Anyone else goes to the login page.
 */
export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect((await getSessionUser()) ? "/admin" : "/account/login");
  }

  const prc = {
    pending: { label: "Awaiting verification", className: "bg-brand-50 text-brand-700" },
    verified: { label: "Verified", className: "bg-success/10 text-success" },
    rejected: { label: "Couldn't be verified", className: "bg-danger/10 text-danger" },
  }[customer.prcStatus];

  return (
    <AccountShell title={`Hello, ${customer.firstName}`} subtitle="Your account details.">
      <dl className="divide-y divide-line text-sm">
        <Row label="Name" value={customerName(customer)} />
        <Row label="Email" value={customer.email} />
        <Row label="Mobile" value={formatPhone(customer.phone)} />
        <Row
          label="PRC ID"
          value={
            <span className="flex flex-wrap items-center justify-end gap-2">
              {customer.prcId}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${prc.className}`}>
                {prc.label}
              </span>
            </span>
          }
        />
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/shop" size="lg" className="flex-1">
          Continue shopping
        </LinkButton>
        <form action={logoutCustomerAction} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-lg border border-line bg-surface px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-elevated"
          >
            Sign out
          </button>
        </form>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}
