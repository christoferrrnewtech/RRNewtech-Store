import type { Metadata } from "next";
import { InquirySent, inquiryRefParam } from "@/components/inquiry/InquirySent";
import { TrackInquiry } from "@/components/inquiry/TrackInquiry";

export const metadata: Metadata = {
  title: "Message sent",
  robots: { index: false, follow: false },
};

/**
 * Where /contact lands after a successful send — the URL Google Ads and Meta count a Contact
 * conversion by. `?type=product` when the message came from a product's "Ask about this product",
 * so the two can be split into separate conversions with a "URL contains" rule.
 *
 * A URL-based conversion counts any visit, including a reload or a typed URL; set the Google Ads
 * conversion to count "One" per click to absorb that. The Pixel/GA events are guarded per inquiry
 * by TrackInquiry.
 */
export default async function ContactThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const inquiryRef = inquiryRefParam(params.ref);
  const fromProduct = params.type === "product";

  return (
    <>
      <TrackInquiry inquiryRef={inquiryRef} source={fromProduct ? "product" : "contact"} />
      <InquirySent
        title="Message sent"
        inquiryRef={inquiryRef}
        cta={{ href: "/", label: "Continue shopping" }}
      >
        {fromProduct
          ? "Our sales team will come back with pricing and availability for this product — usually within one business day."
          : "Thanks — we'll get back to you shortly, usually within one business day."}
      </InquirySent>
    </>
  );
}
