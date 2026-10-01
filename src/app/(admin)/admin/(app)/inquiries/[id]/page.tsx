import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getInquiry } from "@/lib/inquiries";
import { INQUIRY_KIND_LABELS, INQUIRY_STATUS_LABELS } from "@/lib/inquiry-status";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { inquiryTone } from "../tone";
import { DetailList, PageHeader, Panel } from "@/components/admin/Panel";
import { InquiryNoteControl, InquiryStatusControl } from "./InquiryControls";

export const metadata: Metadata = { title: "Inquiry" };

export default async function AdminInquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();

  const replySubject = `Re: your inquiry (${inquiry.ref})`;

  const phone = inquiry.phone.replace(/\s/g, "");

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/inquiries", label: "All inquiries" }}
        title={inquiry.name}
        badges={
          <>
            <StatusBadge
              label={INQUIRY_STATUS_LABELS[inquiry.status]}
              tone={inquiryTone(inquiry.status)}
            />
            {inquiry.kind === "quote" && (
              <span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent">
                {INQUIRY_KIND_LABELS.quote}
              </span>
            )}
          </>
        }
        description={`${inquiry.ref} · received ${formatWhen(inquiry.createdAt)}`}
        actions={
          <>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
              >
                Call
              </a>
            )}
            <a
              href={`mailto:${inquiry.email}?subject=${encodeURIComponent(replySubject)}`}
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Reply by email
            </a>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title={inquiry.kind === "quote" ? "What they need" : "Message"}>
            {inquiry.product && (
              <Link
                href={inquiry.product.href}
                target="_blank"
                className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/60 px-4 py-3 transition-colors hover:border-brand-300"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-muted">Asking about</span>
                  <span className="block truncate font-semibold text-fg">
                    {inquiry.product.name}
                  </span>
                </span>
                <span aria-hidden="true" className="text-sm text-brand-700">
                  ↗
                </span>
              </Link>
            )}
            {/* whitespace-pre-wrap: the customer's own line breaks are part of what they wrote. */}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{inquiry.message}</p>
          </Panel>

          <InquiryStatusControl id={inquiry.id} status={inquiry.status} />
          <InquiryNoteControl id={inquiry.id} note={inquiry.note} />
        </div>

        <aside>
          <Panel title="Contact">
            <DetailList
              items={[
                {
                  label: "Email",
                  value: (
                    <a
                      href={`mailto:${inquiry.email}?subject=${encodeURIComponent(replySubject)}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {inquiry.email}
                    </a>
                  ),
                },
                {
                  label: "Phone",
                  value: phone ? (
                    <a href={`tel:${phone}`} className="font-medium text-brand-700 hover:underline">
                      {inquiry.phone}
                    </a>
                  ) : (
                    <span className="text-muted">Not given</span>
                  ),
                },
                // Optional on the form, and "" on every inquiry taken before the field existed —
                // so the row is dropped entirely rather than shown as empty.
                { label: "Clinic or company", value: inquiry.clinic, hidden: !inquiry.clinic },
                {
                  label: "Account",
                  value: inquiry.userId ? "Signed-in customer" : "Guest",
                },
              ]}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
