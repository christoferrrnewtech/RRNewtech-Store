import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BrandGrid } from "@/components/home/BrandShowcase";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Brands",
  description:
    "The brands R&R Newtech Dental carries — Sprintray, Rundeer, Philips Zoom, SOL Laser, Lasotronix, Curaprox, Kerr, Herculite and Kavoo.",
  alternates: { canonical: "/brands" },
};

/** Brand index — the same card grid as the home page, under its own page header. */
export default function BrandsPage() {
  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:text-brand-700">Home</Link>
      </nav>

      <header className="mb-8 max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg sm:text-3xl">
          Our Brands
        </h1>
        <p className="mt-2 text-muted">
          Digital scanning and printing, whitening, lasers, restoratives and daily oral care — the
          manufacturers we stock and support across the Philippines.
        </p>
      </header>

      <BrandGrid />

      <p className="mt-12 text-xs text-muted-light">
        Looking for a brand we don&rsquo;t list yet? Email {SITE.email} — we source on request.
      </p>
    </Container>
  );
}
