import type { QueueTone } from "@/components/admin/Queue";
import type { InquiryStatus } from "@/lib/inquiry-status";

/** Sales status → badge tone. Its own module so the list and detail pages can't disagree. */
export function inquiryTone(status: InquiryStatus): QueueTone {
  if (status === "new") return "new";
  if (status === "closed") return "dead";
  return "active";
}
