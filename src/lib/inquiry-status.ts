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

/**
 * Which form an inquiry arrived through — CLIENT-SAFE, same reasoning as the status vocabulary.
 *
 * Deliberately separate from `InquiryStatus`: "quoted" is a state sales moves a record *into*,
 * while "quote" is where the record came *from*. A general message can end up quoted, and a quote
 * request can be closed without one.
 */
export type InquiryKind = "message" | "quote";

export const INQUIRY_KINDS: InquiryKind[] = ["message", "quote"];

export const INQUIRY_KIND_LABELS: Record<InquiryKind, string> = {
  message: "Message",
  quote: "Quote request",
};
