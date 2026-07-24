import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NewBrandForm } from "./NewBrandForm";

export const metadata: Metadata = { title: "Brands" };

/**
 * Right-panel content for /admin/brands (nothing selected): the create panel for admins, or a
 * "select a brand" prompt for marketing users. The brand list + header live in the layout.
 */
export default async function AdminBrandsIndex() {
  const user = await requireUser();

  if (user.role === "admin") return <NewBrandForm />;

  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-fg">
        Select a brand to edit
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Choose a brand from the list on the left to edit its page. Your changes go live once the
        brand is published.
      </p>
    </div>
  );
}
