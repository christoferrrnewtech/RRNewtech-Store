import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAboutContent } from "@/lib/content";
import { AboutEditor } from "./AboutEditor";

export const metadata: Metadata = { title: "About section" };

export default async function AdminAboutPage() {
  await requireAdmin();
  const about = await getAboutContent();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
        About section
      </h1>
      <p className="mt-2 text-muted">
        The &ldquo;About&rdquo; band on the storefront home page — heading, paragraphs, the button, and
        the photo. Changes appear immediately. This does not affect the separate{" "}
        <span className="font-medium">/about</span> page.
      </p>

      <AboutEditor content={about} />
    </div>
  );
}
