import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { logoutCustomerAction } from "@/app/(store)/account/actions";
import { getSessionUser } from "@/lib/auth";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerName } from "@/lib/customers";
import { formatPhone } from "@/lib/customer-fields";
import { listOrdersForCustomer } from "@/lib/orders";
import { listInquiriesForCustomer } from "@/lib/inquiries";
import { deriveAddresses } from "@/lib/addresses";
import {
  AddressList,
  Empty,
  InquiryList,
  OrderList,
  Section,
  Unavailable,
} from "./AccountSections";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your R&R Newtech Dental account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

/** How much history the page shows. Beyond this, staff can pull the rest. */
const HISTORY_LIMIT = 20;

/**
 * The customer profile page: details, orders, inquiries, and the addresses they've delivered to.
 *
 * Three outcomes on entry, and the order matters. A customer session renders the page. Failing
 * that, a STAFF session goes to /admin — otherwise an admin clicking the header's account link
 * would be sent to a login form they had already passed, and round-trip straight back here.
 * Anyone else goes to the login page.
 */
export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect((await getSessionUser()) ? "/admin" : "/account/login");
  }

  // Both panels are independent, so they're fetched together rather than in series — and settled
  // rather than awaited, so one failing query degrades its own panel instead of 500-ing the page.
  // The realistic failure is an un-deployed composite index; see firestore.indexes.json.
  const [ordersResult, inquiriesResult] = await Promise.allSettled([
    listOrdersForCustomer(customer.email, HISTORY_LIMIT),
    listInquiriesForCustomer(customer.email, HISTORY_LIMIT),
  ]);

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const inquiries = inquiriesResult.status === "fulfilled" ? inquiriesResult.value : null;
  // Derived from order history — there is no address book. See addresses.ts.
  const addresses = orders ? deriveAddresses(orders) : null;

  const prc = {
    pending: { label: "Awaiting verification", className: "bg-brand-50 text-brand-700" },
    verified: { label: "Verified", className: "bg-success/10 text-success" },
    rejected: { label: "Couldn't be verified", className: "bg-danger/10 text-danger" },
  }[customer.prcStatus];

  return (
    <AccountShell width="full" title={`Hello, ${customer.firstName}`} subtitle={customer.email}>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            Your details
          </h2>
          <form action={logoutCustomerAction}>
            <button
              type="submit"
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
            >
              Sign out
            </button>
          </form>
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Name" value={customerName(customer)} />
          <Row label="Mobile" value={formatPhone(customer.phone)} />
          <Row label="Email" value={customer.email} />
          <Row
            label="PRC ID"
            value={
              <span className="flex flex-wrap items-center gap-2">
                {customer.prcId}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${prc.className}`}
                >
                  {prc.label}
                </span>
              </span>
            }
          />
        </dl>
      </section>

      <Section title="Orders" count={orders?.length}>
        {orders ? <OrderList orders={orders} /> : <Unavailable what="orders" />}
      </Section>

      <Section
        title="Inquiries"
        count={inquiries?.length}
        action={
          <Link href="/contact" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            Ask a question
          </Link>
        }
      >
        {inquiries ? <InquiryList inquiries={inquiries} /> : <Unavailable what="inquiries" />}
      </Section>

      <Section title="Addresses" count={addresses?.length}>
        {addresses ? (
          <AddressList addresses={addresses} />
        ) : (
          // Addresses come out of the orders query, so they're missing for the same reason.
          <Empty>Addresses you deliver to will appear here after your first order.</Empty>
        )}
      </Section>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
    </div>
  );
}
