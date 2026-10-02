"use client";

import { useEffect } from "react";
import { trackContact, trackLead } from "@/lib/analytics";

/**
 * Fires the Pixel/GA conversion for a sent inquiry, once, from its thank-you page.
 *
 * The thank-you URL can be reloaded or reopened from history, so a per-inquiry flag in
 * localStorage keeps it to one conversion per browser, and the Pixel's eventID (the inquiry ref)
 * dedupes anything that slips past, e.g. storage blocked in a private window. Same approach as
 * TrackPurchase.
 *
 * Renders nothing without a `ref`: that is a bot the honeypot caught, or someone who typed the URL,
 * and neither sent an inquiry. Google Ads' URL-based conversions can't see this guard — see the
 * thank-you pages for why that's acceptable.
 */
export function TrackInquiry({
  inquiryRef,
  source,
}: {
  inquiryRef?: string;
  source: "quote" | "contact" | "product";
}) {
  useEffect(() => {
    if (!inquiryRef) return;
    const key = `rr:inquiry-tracked:${inquiryRef}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — fall through and rely on eventID.
    }
    if (source === "quote") trackLead(inquiryRef);
    else trackContact(inquiryRef, source);
  }, [inquiryRef, source]);

  return null;
}
