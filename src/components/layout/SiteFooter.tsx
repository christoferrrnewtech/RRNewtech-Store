import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SITE } from "@/lib/constants";
import { getCategories } from "@/lib/content";

export async function SiteFooter() {
  const year = new Date().getFullYear();
  const categories = await getCategories().catch(() => []);

  return (
    <footer className="mt-16 bg-ink text-white/80 lg:mt-20">
      {/*
        Two columns from the smallest width up. Stacking all four blocks made the footer ~1300px
        tall on a phone; the two link lists sit side by side instead, and only the brand and contact
        blocks span the full width.
      */}
      <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4 lg:gap-10 lg:py-14">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            {/* The logo already carries its own brand-blue field, so the Clinical White tile is only
                a hairline edge separating it from the ink footer — hence p-0.5, not real clear space.
                Inner radius is one step down from the tile's so the blue corners follow the curve. */}
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white p-0.5">
              <Image
                src="/brand/logo.png"
                alt={`${SITE.name} logo`}
                width={36}
                height={36}
                className="h-full w-full rounded-md"
              />
            </span>
            <span className="text-base font-bold text-white">Newtech Dental</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{SITE.tagline}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm lg:mt-4">
            <li>
              <Link href="/" className="text-white/70 hover:text-white">
                All products
              </Link>
            </li>
            {/* Four, not five — category names here run long ("Cosmetic & Restorative Dentistry"),
                and in a half-width mobile column each extra one costs two or three lines. */}
            {categories.slice(0, 4).map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="text-white/70 hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Company</h3>
          <ul className="mt-3 space-y-2 text-sm lg:mt-4">
            <li><Link href="/about" className="text-white/70 hover:text-white">About us</Link></li>
            <li><Link href="/contact" className="text-white/70 hover:text-white">Contact</Link></li>
            <li><Link href="/faq" className="text-white/70 hover:text-white">FAQ</Link></li>
            <li><Link href="/shipping-returns" className="text-white/70 hover:text-white">Shipping &amp; Returns</Link></li>
          </ul>
        </div>

        <div className="col-span-2 lg:col-span-1">
          <h3 className="text-sm font-semibold text-white">Get in touch</h3>
          {/* Real <address> element: this is the business's own contact block, which is exactly
              what the tag is for. `not-italic` because browsers italicise it by default. */}
          <address className="mt-3 max-w-sm text-sm not-italic leading-relaxed text-white/70 lg:mt-4">
            {SITE.addressLine}
          </address>
          <p className="mt-3 text-sm">
            <a href={`mailto:${SITE.email}`} className="text-white/70 hover:text-white">
              {SITE.email}
            </a>
          </p>
          {/* Mobile has the width for two numbers per row; at lg the column is narrow again, so
              they go back to one per line. All four stay reachable either way. */}
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm lg:block lg:space-y-1.5">
            {SITE.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`} className="whitespace-nowrap text-white/70 hover:text-white">
                  {p.label ? `${p.label}: ${p.value}` : p.value}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/50">{SITE.supportLine}</p>
          <div className="mt-4 flex gap-3">
            <SocialIcon href={SITE.socials.facebook} label="Facebook">
              <path d="M15 8.5h-2a1 1 0 0 0-1 1V12h3l-.5 3H12v6H9v-6H7v-3h2V9a3 3 0 0 1 3-3h3v2.5Z" />
            </SocialIcon>
            <SocialIcon href={SITE.socials.instagram} label="Instagram">
              <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="16.4" cy="7.6" r="1.1" />
            </SocialIcon>
            <SocialIcon href={SITE.socials.linkedin} label="LinkedIn">
              <path d="M7.2 9.5v8.3H4.6V9.5h2.6ZM5.9 5.3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM19.4 17.8h-2.6v-4.1c0-1-.4-1.7-1.3-1.7-.7 0-1.1.5-1.3 1-.1.2-.1.4-.1.7v4.1H11.5s0-7 0-8.3h2.6v1.2c.3-.5 1-1.3 2.4-1.3 1.7 0 3 1.1 3 3.6v4.8Z" />
            </SocialIcon>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        {/* Three tracks so the © centres against the full container width rather than against
            whatever is left over beside the links; column 1 stays empty. */}
        <Container className="flex flex-col items-center gap-2 py-5 text-xs text-white/50 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:py-6">
          <p className="text-center sm:col-start-2">© {year} {SITE.legalName}. All rights reserved.</p>
          <div className="flex gap-4 sm:col-start-3 sm:justify-end">
            <Link href="/privacy" className="hover:text-white/80">Privacy</Link>
            <Link href="/terms" className="hover:text-white/80">Terms</Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}

/** Circular social link with an inline brand glyph — opens in a new tab. */
function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}
