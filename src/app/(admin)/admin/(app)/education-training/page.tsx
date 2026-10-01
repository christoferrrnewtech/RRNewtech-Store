import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAllSessionsForAdmin, getLinkOptions } from "@/lib/content";
import { SessionsManager } from "./SessionsManager";

export const metadata: Metadata = { title: "Education & Training" };

export default async function AdminEducationTrainingPage() {
  await requireAdmin();
  // The admin list keeps past campaigns — only the storefront filters them out.
  const [sessions, linkOptions] = await Promise.all([
    getAllSessionsForAdmin(),
    // Suggestions for the button link boxes, so paths are picked rather than typed from memory.
    getLinkOptions().catch(() => []),
  ]);

  return (
    <div>
      <SessionsManager sessions={sessions} linkOptions={linkOptions} />
    </div>
  );
}
