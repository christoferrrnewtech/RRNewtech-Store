import type { Metadata } from "next";
import { InquirySent, inquiryRefParam } from "@/components/inquiry/InquirySent";
import { TrackInquiry } from "@/components/inquiry/TrackInquiry";

export const metadata: Metadata = {
  title: "Quote request sent",
  robots: { index: false, follow: false },
};

/**
 * Where /request-quote lands after a successful send — the URL Google Ads and Meta count a Lead
 * conversion by. See /contact/thank-you on counting and reloads.
 */
export default async function RequestQuoteThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const inquiryRef = inquiryRefParam((await searchParams).ref);

  return (
    <>
      <TrackInquiry inquiryRef={inquiryRef} source="quote" />
      <InquirySent
        title="Quote request sent"
        inquiryRef={inquiryRef}
        cta={{ href: "/shop", label: "Browse products" }}
      >
        Our sales team will come back with pricing, availability and delivery timelines — usually
        within one business day.
      </InquirySent>
    </>
  );
}
