import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { SITE } from "@/lib/constants";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { StructuredData } from "@/components/analytics/StructuredData";
import "./globals.css";

// DM Sans throughout — headings and body both. Hierarchy comes from weight and size rather than
// from a second typeface, as it did under the brand manual's single-family Kumbh Sans.
//
// Variable, so `weight` is deliberately omitted: that ships the whole 100-1000 axis in one file
// instead of a static cut per weight, and it means `font-extrabold` (800) is a real cut rather
// than a synthesised one.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Dental Supplies & Equipment Online in the Philippines`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "dental supplies Philippines",
    "dental equipment Philippines",
    "buy dental supplies online",
    "dental consumables",
    "dental instruments Philippines",
    "orthodontic supplies Philippines",
    "R&R Newtech Dental",
  ],
  authors: [{ name: SITE.legalName, url: SITE.url }],
  alternates: { canonical: "/", languages: { "en-PH": SITE.url } },
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — Dental Supplies & Equipment Online`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Dental Supplies & Equipment Online`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  // Favicon + Apple touch icon are file-based: src/app/icon.png & src/app/apple-icon.png.
  // Next.js auto-generates the <link> tags, so no manual `icons` entry is needed here.
};

export const viewport: Viewport = {
  themeColor: "#2d3791",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout: document shell only. The storefront chrome (header, footer, cart) lives in
 * src/app/(store)/layout.tsx so that the admin route group can opt out of it entirely.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PH" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full bg-bg text-fg antialiased">
        <MetaPixel />
        <GoogleAnalytics />
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
