import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · R&R Admin" },
  robots: { index: false, follow: false },
};

/** Bare shell for the admin — deliberately no storefront header, footer or cart. */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-full bg-bg">{children}</div>;
}
