import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getInquiry } from "@/lib/inquiries";
import { StatusBadge, formatWhen } from "@/components/admin/Queue";
import { inquiryTone } from "../tone";
import { InquiryControls } from "./InquiryControls";

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

  return (
    <div>
      <Link
        href="/admin/inquiries"
        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        ← All inquiries
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
          {inquiry.name}
        </h1>
        <StatusBadge label={inquiry.status} tone={inquiryTone(inquiry.status)} />
      </div>
      <p className="mt-2 text-muted">
        {inquiry.ref} · received {formatWhen(inquiry.createdAt)}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {inquiry.product && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                Asking about
              </h2>
              <Link
                href={inquiry.product.href}
                target="_blank"
                className="mt-1 block font-semibold text-fg hover:text-brand-700"
              >
                {inquiry.product.name} ↗
              </Link>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-fg">Message</h2>
            {/* whitespace-pre-wrap: the customer's own line breaks are part of what they wrote. */}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {inquiry.message}
            </p>
          </section>

          <InquiryControls id={inquiry.id} status={inquiry.status} note={inquiry.note} />
        </div>

        <aside>
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-fg">Contact</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted-light">Email</dt>
                <dd>
                  <a
                    href={`mailto:${inquiry.email}?subject=${encodeURIComponent(replySubject)}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {inquiry.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-light">Phone</dt>
                <dd>
                  {inquiry.phone ? (
                    <a
                      href={`tel:${inquiry.phone.replace(/\s/g, "")}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {inquiry.phone}
                    </a>
                  ) : (
                    <span className="text-muted">Not given</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
