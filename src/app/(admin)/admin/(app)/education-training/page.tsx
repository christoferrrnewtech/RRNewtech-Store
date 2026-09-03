import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAllSessionsForAdmin } from "@/lib/content";
import { SessionsManager } from "./SessionsManager";

export const metadata: Metadata = { title: "Training campaigns" };

export default async function AdminEducationTrainingPage() {
  await requireAdmin();
  // The admin list keeps past campaigns — only the storefront filters them out.
  const sessions = await getAllSessionsForAdmin();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        Training campaigns
      </h1>
      <p className="mt-2 text-muted">
        Seminars, workshops and demos listed on the storefront&apos;s Education &amp; Training page.
        Changes appear immediately. Campaigns dated before today stay here for reference but drop
        off the storefront automatically.
      </p>

      <SessionsManager sessions={sessions} />
    </div>
  );
}
