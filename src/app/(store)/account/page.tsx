import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { logoutCustomerAction } from "@/app/(store)/account/actions";
import { getSessionUser } from "@/lib/auth";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerName } from "@/lib/customers";
import { formatPhone } from "@/lib/customer-fields";
import { listOrdersForCustomer } from "@/lib/orders";
import { listInquiriesForCustomer } from "@/lib/inquiries";
import { deriveAddresses } from "@/lib/addresses";
import { listCustomerAddresses } from "@/lib/customer-addresses";
import { getProvinces } from "@/lib/locations";
import { AddressBook } from "./AddressBook";
import { AccountDashboard } from "./AccountDashboard";
import { isAccountTab, type AccountTab } from "./account-tabs";
import {
  InquiryList,
  OrderList,
  Overview,
  PanelHeader,
  Unavailable,
  payableOrders,
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
 * The customer profile page: details, orders, inquiries, and the addresses they've delivered to —
 * one tab at a time (see AccountDashboard), so a long order history doesn't bury everything below.
 *
 * Three outcomes on entry, and the order matters. A customer session renders the page. Failing
 * that, a STAFF session goes to /admin — otherwise an admin clicking the header's account link
 * would be sent to a login form they had already passed, and round-trip straight back here.
 * Anyone else goes to the login page.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initial: AccountTab = isAccountTab(tab) ? tab : "overview";

  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect((await getSessionUser()) ? "/admin" : "/account/login");
  }

  // Both panels are independent, so they're fetched together rather than in series — and settled
  // rather than awaited, so one failing query degrades its own panel instead of 500-ing the page.
  // The realistic failure is an un-deployed composite index; see firestore.indexes.json.
  // Both are matched on uid as well as email, so an order placed — or a question asked — from a
  // different address still lands here. See listOrdersForCustomer / listInquiriesForCustomer.
  const [ordersResult, inquiriesResult, addressesResult] = await Promise.allSettled([
    listOrdersForCustomer({ uid: customer.uid, email: customer.email }, HISTORY_LIMIT),
    listInquiriesForCustomer({ uid: customer.uid, email: customer.email }, HISTORY_LIMIT),
    listCustomerAddresses(customer.uid),
  ]);

  // Logged, not swallowed: the panel's "couldn't load" wording is all the customer needs, but
  // without this the cause (almost always an un-deployed composite index, which Firestore reports
  // as FAILED_PRECONDITION with a ready-made create-index URL) never reaches anyone who can fix it.
  if (ordersResult.status === "rejected") {
    console.error("[account] could not load orders:", ordersResult.reason);
  }
  if (inquiriesResult.status === "rejected") {
    console.error("[account] could not load inquiries:", inquiriesResult.reason);
  }
  if (addressesResult.status === "rejected") {
    console.error("[account] could not load addresses:", addressesResult.reason);
  }

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const inquiries = inquiriesResult.status === "fulfilled" ? inquiriesResult.value : null;
  const addresses = addressesResult.status === "fulfilled" ? addressesResult.value : null;

  /**
   * Addresses that appear in past orders but aren't in the book yet.
   *
   * Only ever non-zero for someone who ordered before the book existed — checkout has remembered
   * the address on every order since. Counted here so the import button appears only when it has
   * something to do; the action itself re-derives from the orders rather than trusting this.
   */
  const importable =
    orders && addresses
      ? deriveAddresses(orders).filter((d) => !addresses.some((a) => a.key === d.key)).length
      : 0;

  const prc = {
    pending: { label: "Awaiting verification", className: "bg-brand-50 text-brand-700" },
    verified: { label: "Verified", className: "bg-success/10 text-success" },
    rejected: { label: "Couldn't be verified", className: "bg-danger/10 text-danger" },
  }[customer.prcStatus];

  const details = (
    <dl className="grid gap-x-8 gap-y-4 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2 sm:p-6">
      <Row label="Name" value={customerName(customer)} />
      <Row label="Mobile" value={formatPhone(customer.phone)} />
      <Row label="Email" value={<span className="break-all">{customer.email}</span>} />
      <Row
        label="PRC ID"
        value={
          <span className="flex flex-wrap items-center gap-2">
            {customer.prcId}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${prc.className}`}>
              {prc.label}
            </span>
          </span>
        }
      />
    </dl>
  );

  const initials = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase();

  return (
    <Container className="flex-1 py-8 sm:py-12">
      <h1 className="sr-only">Your account</h1>
      <AccountDashboard
        initial={initial}
        profile={
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 font-[family-name:var(--font-display)] text-base font-bold text-white"
            >
              {initials || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-display)] text-base font-bold text-fg">
                {customerName(customer)}
              </p>
              <p className="truncate text-xs text-muted">{customer.email}</p>
              <span
                className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${prc.className}`}
              >
                PRC · {prc.label}
              </span>
            </div>
          </div>
        }
        signOut={
          <form action={logoutCustomerAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-elevated hover:text-danger lg:w-full lg:text-left"
            >
              Sign out
            </button>
          </form>
        }
        tabs={[
          { id: "overview", label: "Overview" },
          {
            id: "orders",
            label: "Orders",
            count: orders?.length,
            attention: orders ? payableOrders(orders).length > 0 : false,
          },
          { id: "inquiries", label: "Inquiries", count: inquiries?.length },
          { id: "addresses", label: "Addresses", count: addresses?.length },
        ]}
        panels={{
          overview: <Overview details={details} orders={orders} inquiries={inquiries} />,
          orders: (
            <>
              <PanelHeader
                title="Orders"
                description="Tap an order to see its items, totals and delivery address."
              />
              {orders ? <OrderList orders={orders} /> : <Unavailable what="orders" />}
            </>
          ),
          inquiries: (
            <>
              <PanelHeader
                title="Inquiries"
                description="Questions and quote requests you've sent our sales team."
                action={
                  <Link
                    href="/contact"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Ask a question
                  </Link>
                }
              />
              {inquiries ? <InquiryList inquiries={inquiries} /> : <Unavailable what="inquiries" />}
            </>
          ),
          addresses: (
            <>
              <PanelHeader
                title="Addresses"
                description="Saved delivery addresses, ready to pick at checkout."
              />
              {addresses ? (
                <AddressBook
                  addresses={addresses}
                  // Rendered in rather than fetched, exactly as checkout does it: 82 names is
                  // nothing to send, and it means the first dropdown works on first paint.
                  provinces={getProvinces()}
                  defaults={{
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    phone: customer.phone,
                  }}
                  importable={importable}
                />
              ) : (
                <Unavailable what="addresses" />
              )}
            </>
          ),
        }}
      />
    </Container>
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
