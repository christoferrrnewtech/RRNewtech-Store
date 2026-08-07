import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import {
  listInquiries,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/lib/inquiries";
import {
  EmptyQueue,
  QueueList,
  QueuePager,
  QueueRow,
  StatusBadge,
  StatusFilter,
  formatWhen,
} from "@/components/admin/Queue";
import { inquiryTone } from "./tone";

export const metadata: Metadata = { title: "Inquiries" };

const PAGE_SIZE = 50;

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; before?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = INQUIRY_STATUSES.includes(params.status as InquiryStatus)
    ? (params.status as InquiryStatus)
    : undefined;
  const before = Number(params.before) || undefined;

  const inquiries = await listInquiries({ status, before, limit: PAGE_SIZE });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Inquiries
      </h1>
      <p className="mt-2 text-muted">
        Messages from the contact form, including &ldquo;Contact a sales agent&rdquo; requests on
        products priced on request.
      </p>

      <StatusFilter
        basePath="/admin/inquiries"
        active={status}
        options={INQUIRY_STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABELS[s] }))}
      />

      {inquiries.length === 0 ? (
        <EmptyQueue>
          {status
            ? `No ${INQUIRY_STATUS_LABELS[status].toLowerCase()} inquiries.`
            : "No inquiries yet. Messages sent from the contact form land here."}
        </EmptyQueue>
      ) : (
        <QueueList>
          {inquiries.map((inquiry) => (
            <QueueRow key={inquiry.id} href={`/admin/inquiries/${inquiry.id}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-fg">
                  {inquiry.name}
                  <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-wide text-muted-light">
                    {inquiry.ref}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {inquiry.product ? `About ${inquiry.product.name} · ` : ""}
                  {inquiry.message}
                </p>
                <p className="mt-0.5 text-xs text-muted-light">{formatWhen(inquiry.createdAt)}</p>
              </div>
              <StatusBadge
                label={INQUIRY_STATUS_LABELS[inquiry.status]}
                tone={inquiryTone(inquiry.status)}
              />
            </QueueRow>
          ))}
        </QueueList>
      )}

      <QueuePager
        basePath="/admin/inquiries"
        params={{ status }}
        lastCreatedAt={inquiries.at(-1)?.createdAt}
        full={inquiries.length === PAGE_SIZE}
      />
    </div>
  );
}
