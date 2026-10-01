import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAboutContent } from "@/lib/content";
import { PageHeader } from "@/components/admin/Panel";
import { AboutEditor } from "./AboutEditor";

export const metadata: Metadata = { title: "About section" };

export default async function AdminAboutPage() {
  await requireAdmin();
  const about = await getAboutContent();

  return (
    <div>
      <PageHeader
        title="About section"
        description={
          <>
            The &ldquo;About&rdquo; band on the home page. Changes appear immediately. The separate{" "}
            <span className="font-medium text-fg">/about</span>{" "}page isn&apos;t affected.
          </>
        }
      />

      <AboutEditor content={about} />
    </div>
  );
}
