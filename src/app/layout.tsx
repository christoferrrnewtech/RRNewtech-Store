import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { SITE } from "@/lib/constants";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { StructuredData } from "@/components/analytics/StructuredData";
import "./globals.css";

// Two families, split by role: Space Grotesk sets headings and display text, DM Sans carries body
// copy. This replaces the single-family Kumbh Sans pairing the brand manual specifies for digital.
//
// Both are variable fonts, so `weight` is deliberately omitted — that ships the whole axis in one
// file rather than a static cut per weight. Worth knowing: Space Grotesk's axis stops at 700, so
// `font-extrabold` on a heading would be synthesised. The five extrabold call sites are all price
// and badge spans, which stay on DM Sans (axis to 1000), so nothing currently hits that ceiling.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en-PH" className={`${spaceGrotesk.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full bg-bg text-fg antialiased">
        <MetaPixel />
        <GoogleAnalytics />
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
