/**
 * Inquiry status vocabulary — CLIENT-SAFE. See `order-status.ts` for why this is split out of the
 * server-only `inquiries.ts`.
 */

export type InquiryStatus = "new" | "contacted" | "quoted" | "closed";

export const INQUIRY_STATUSES: InquiryStatus[] = ["new", "contacted", "quoted", "closed"];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  closed: "Closed",
};
