import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAllBrandsForAdmin, getUsers, type Brand } from "@/lib/content";
import { countNewOrders, countOrdersByPayment, listOrders, type Order } from "@/lib/orders";
import { countNewInquiries, listInquiries, type Inquiry } from "@/lib/inquiries";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { PAYMENT_STATUS_LABELS } from "@/lib/payment-status";
import { INQUIRY_STATUS_LABELS } from "@/lib/inquiry-status";
import { formatPHP } from "@/lib/format";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { StatusPill } from "@/components/admin/StatusPill";
import { orderTone, paymentTone } from "./orders/tone";
import { inquiryTone } from "./inquiries/tone";

/**
 * The admin landing page — built around "what needs me right now?", then "where do I go to change
 * X?".
 *
 * Admins get the work first: counts that link straight into the filtered queue, the latest orders
 * and inquiries, then shortcuts to every storefront editor, then the brands. Marketing users can't
 * see orders, inquiries or the storefront editors, so for them the page is their brands.
 *
 * Every read is settled independently and falls back to "couldn't load" for its own panel. A
 * missing index or a Firestore hiccup must not take the whole landing page down — this is the page
 * staff hit first after signing in.
 */
export default async function AdminDashboard() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const brands = (await getAllBrandsForAdmin().catch(() => [] as Brand[])).filter(
    (b) => isAdmin || user.brandSlugs.includes(b.slug),
  );

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{todayInManila()}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
            {greeting()}, {user.name.split(" ")[0] || "there"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            {isAdmin
              ? "Here's what's waiting on you, plus shortcuts to everything you can edit."
              : brands.length > 0
                ? `You can edit ${brands.length === 1 ? "1 brand" : `${brands.length} brands`}. Published changes go live straight away.`
                : "You don't have any brands assigned yet."}
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
        >
          <AdminIcon name="storefront" size={16} />
          View storefront
        </Link>
      </header>

      {isAdmin ? <AdminHome brands={brands} /> : <MarketingHome brands={brands} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

async function AdminHome({ brands }: { brands: Brand[] }) {
  const [toFulfil, newInquiries, awaiting, orders, inquiries, users] = await Promise.all([
    countNewOrders().catch(() => null),
    countNewInquiries().catch(() => null),
    countOrdersByPayment("awaiting_payment").catch(() => null),
    listOrders({ limit: 5 }).catch(() => null),
    listInquiries({ limit: 5 }).catch(() => null),
    getUsers().catch(() => null),
  ]);

  const drafts = brands.filter((b) => b.status === "draft").length;
  const teammates = users?.filter((u) => u.role === "marketing").length ?? null;

  return (
    <>
      <section aria-label="Needs attention" className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          href="/admin/orders?status=new"
          icon="orders"
          label="Orders to fulfil"
          value={toFulfil}
          detail="Paid, waiting to be confirmed"
          urgent
        />
        <StatTile
          href="/admin/inquiries?status=new"
          icon="inquiries"
          label="New inquiries"
          value={newInquiries}
          detail="Not replied to yet"
          urgent
        />
        <StatTile
          href="/admin/orders?payment=awaiting_payment"
          icon="clock"
          label="Awaiting payment"
          value={awaiting}
          detail="Checkouts not paid yet"
        />
        <StatTile
          href="/admin/brands"
          icon="brands"
          label="Draft brands"
          value={drafts}
          detail="Hidden from the storefront"
        />
      </section>

      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Panel title="Latest orders" href="/admin/orders?payment=all" linkLabel="All orders">
          {!orders ? (
            <PanelNote>We couldn&apos;t load orders just now.</PanelNote>
          ) : orders.length === 0 ? (
            <PanelNote>No orders yet. They&apos;ll show up here as soon as someone checks out.</PanelNote>
          ) : (
            <RowList>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </RowList>
          )}
        </Panel>

        <Panel title="Latest inquiries" href="/admin/inquiries" linkLabel="All inquiries">
          {!inquiries ? (
            <PanelNote>We couldn&apos;t load inquiries just now.</PanelNote>
          ) : inquiries.length === 0 ? (
            <PanelNote>No inquiries yet.</PanelNote>
          ) : (
            <RowList>
              {inquiries.map((inquiry) => (
                <InquiryRow key={inquiry.id} inquiry={inquiry} />
              ))}
            </RowList>
          )}
        </Panel>
      </div>

      <section className="mt-12">
        <SectionTitle
          title="Edit the storefront"
          description="Jump straight to the part of the site you want to change."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Shortcut
            href="/admin/banner"
            icon="banner"
            title="Home banner"
            detail="Hero slides, headlines and buttons"
          />
          <Shortcut
            href="/admin/shop-by-category"
            icon="shop"
            title="Shop by category"
            detail="The category board on the home page"
          />
          <Shortcut
            href="/admin/about"
            icon="about"
            title="About section"
            detail="Home page intro copy and image"
          />
          <Shortcut
            href="/admin/education-training"
            icon="events"
            title="Education & Training"
            detail="Courses, sessions and events"
          />
          <Shortcut
            href="/admin/categories"
            icon="categories"
            title="Categories"
            detail="How products are grouped in the shop"
          />
          <Shortcut
            href="/admin/users"
            icon="users"
            title="Marketing team"
            detail={
              teammates === null
                ? "Who can edit which brands"
                : `${teammates} ${teammates === 1 ? "teammate" : "teammates"} with brand access`
            }
          />
        </div>
      </section>

      <BrandsSection
        brands={brands}
        title="Brands"
        description={`${brands.length - drafts} published · ${drafts} draft`}
        manageHref="/admin/brands"
      />
    </>
  );
}

function StatTile({
  href,
  icon,
  label,
  value,
  detail,
  urgent = false,
}: {
  href: string;
  icon: AdminIconName;
  label: string;
  /** null when the count couldn't be read. */
  value: number | null;
  detail: string;
  /** Draws attention when non-zero. Only for queues where a waiting record is a customer waiting. */
  urgent?: boolean;
}) {
  const hot = urgent && value !== null && value > 0;
  return (
    <Link
      href={href}
      className={`flex flex-col rounded-2xl border bg-surface p-4 transition-colors hover:border-brand-300 sm:p-5 ${
        hot ? "border-brand-200 ring-1 ring-brand-200" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted sm:text-sm">{label}</span>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            hot ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
          }`}
        >
          <AdminIcon name={icon} size={16} />
        </span>
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:mt-3 sm:text-3xl">
        {value ?? "—"}
      </p>
      <p className="mt-1 text-xs text-muted sm:text-sm">
        {value === 0 && urgent ? "All caught up" : value === null ? "Couldn't load" : detail}
      </p>
    </Link>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <li>
      <Link
        href={`/admin/orders/${order.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-elevated sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            {order.customer.firstName} {order.customer.lastName}
            <span className="ml-2 font-[family-name:var(--font-display)] text-xs font-bold tracking-wide text-muted-light">
              {order.ref}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{formatWhen(order.createdAt)}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-fg">{formatPHP(order.total)}</span>
        {/* One pill: the payment problem when there is one, otherwise where fulfilment is. */}
        {order.paymentStatus !== "paid" && order.status !== "cancelled" ? (
          <StatusBadge
            label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
            tone={paymentTone(order.paymentStatus)}
          />
        ) : (
          <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={orderTone(order.status)} />
        )}
      </Link>
    </li>
  );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  return (
    <li>
      <Link
        href={`/admin/inquiries/${inquiry.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-elevated sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            {inquiry.name}
            {inquiry.kind === "quote" && (
              <span className="ml-2 text-xs font-medium text-accent">Quote request</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {inquiry.product ? `${inquiry.product.name} · ` : ""}
            {formatWhen(inquiry.createdAt)}
          </p>
        </div>
        <StatusBadge
          label={INQUIRY_STATUS_LABELS[inquiry.status]}
          tone={inquiryTone(inquiry.status)}
        />
      </Link>
    </li>
  );
}

function Shortcut({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: AdminIconName;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
        <AdminIcon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      <span aria-hidden="true" className="text-muted-light transition-colors group-hover:text-brand-700">
        →
      </span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketing
// ─────────────────────────────────────────────────────────────────────────────

function MarketingHome({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <AdminIcon name="brands" size={22} />
        </span>
        <p className="mt-4 font-semibold text-fg">No brands assigned yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Ask an admin to give you access to the brands you look after. They&apos;ll appear here
          once they do.
        </p>
      </div>
    );
  }

  return (
    <>
      <BrandsSection brands={brands} title="Your brands" description="Pick a brand to edit its page and products." />

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Tip title="Draft or published?">
          Draft brands are hidden from the storefront. Once a brand is published, every saved change
          shows up for customers straight away.
        </Tip>
        <Tip title="Need another brand?">
          You can only edit the brands an admin has assigned to you. Ask an admin to add more.
        </Tip>
      </section>
    </>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

/** Brand cards with logos — easier to find a brand by eye than in a list of names. */
function BrandsSection({
  brands,
  title,
  description,
  manageHref,
}: {
  brands: Brand[];
  title: string;
  description: string;
  manageHref?: string;
}) {
  if (brands.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle title={title} description={description} />
        {manageHref && (
          <Link href={manageHref} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            Manage brands →
          </Link>
        )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {brands.map((brand) => (
          <li key={brand.slug}>
            <BrandCard brand={brand} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  const published = brand.status === "published";
  const products = brand.products.length;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-brand-300">
      <Link href={`/admin/brands/${brand.slug}`} className="flex flex-1 flex-col">
        {/* Logos carry their own backgrounds, so they always sit on white. */}
        <div className="relative aspect-[2/1] border-b border-line bg-white">
          {brand.logo ? (
            <Image
              src={brand.logo}
              alt=""
              fill
              sizes="(min-width: 1280px) 240px, (min-width: 1024px) 30vw, 45vw"
              className="object-contain p-4 sm:p-6"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] text-lg font-bold text-muted-light">
              {brand.name}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg group-hover:text-brand-700">{brand.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              {products} {products === 1 ? "product" : "products"}
            </p>
          </div>
          <StatusPill status={brand.status} />
        </div>
      </Link>
      <div className="flex border-t border-line text-xs font-semibold">
        <Link
          href={`/admin/brands/${brand.slug}`}
          className="flex-1 px-2 py-2.5 text-center text-brand-700 hover:bg-elevated"
        >
          Edit
        </Link>
        {published && (
          <Link
            href={`/brands/${brand.slug}`}
            target="_blank"
            className="flex-1 border-l border-line px-2 py-2.5 text-center text-muted hover:bg-elevated hover:text-fg"
          >
            View live ↗
          </Link>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <SectionTitle title={title} />
        <Link href={href} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          {linkLabel} →
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RowList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {children}
    </ul>
  );
}

function PanelNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/** Staff work in Manila time, whatever timezone the server runs in. */
function manilaHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-PH", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" })
      .formatToParts(new Date())
      .find((p) => p.type === "hour")?.value ?? 12,
  );
}

function greeting(): string {
  const hour = manilaHour();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayInManila(): string {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}
