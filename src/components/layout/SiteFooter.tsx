import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/constants";
import { CATEGORIES } from "@/lib/products";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-ink text-white/80">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {/* Clear space: logo sits in a Clinical White tile with room to breathe (manual §Clear Space) */}
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1.5">
              <Image
                src="/brand/logo.png"
                alt={`${SITE.name} logo`}
                width={28}
                height={28}
                className="h-7 w-7 rounded"
              />
            </span>
            <span className="text-base font-bold text-white">Newtech Dental</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{SITE.tagline}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Shop</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-white/70 hover:text-white">
                All products
              </Link>
            </li>
            {CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link href={`/?category=${c.slug}`} className="text-white/70 hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Company</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/about" className="text-white/70 hover:text-white">About us</Link></li>
            <li><Link href="/contact" className="text-white/70 hover:text-white">Contact</Link></li>
            <li><Link href="/faq" className="text-white/70 hover:text-white">FAQ</Link></li>
            <li><Link href="/shipping-returns" className="text-white/70 hover:text-white">Shipping &amp; Returns</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Get in touch</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`mailto:${SITE.email}`} className="text-white/70 hover:text-white">
                {SITE.email}
              </a>
            </li>
            <li className="text-white/70">{SITE.phone}</li>
            <li className="text-white/50">{SITE.supportLine}</li>
          </ul>
          <div className="mt-4 flex gap-3">
            <a href={SITE.socials.facebook} className="text-white/70 hover:text-white" aria-label="Facebook">Facebook</a>
            <a href={SITE.socials.instagram} className="text-white/70 hover:text-white" aria-label="Instagram">Instagram</a>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {SITE.legalName}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white/80">Privacy</Link>
            <Link href="/terms" className="hover:text-white/80">Terms</Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
