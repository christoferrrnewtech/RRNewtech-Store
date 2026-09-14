import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { UTILITY_BAR } from "@/lib/constants";

/**
 * Slim dark strip at the very top of the storefront: who we are on the left, the sales route on
 * the right.
 *
 * Rendered OUTSIDE `SiteHeader` (see (store)/layout.tsx) on purpose. The header is `sticky top-0`
 * and other components position against its height — 64px mobile / 128px at `lg` — so folding this
 * strip into it would break `CheckoutClient`'s `lg:sticky lg:top-36` and the `scroll-mt-36` anchors.
 * Out here it simply scrolls away, and the header keeps its contract.
 */
export function TopUtilityBar() {
  return (
    <div className="bg-ink text-xs text-white/80">
      <Container className="flex items-center justify-between gap-4 py-2.5">
        <p className="truncate">{UTILITY_BAR.left}</p>
        {/* Secondary on a narrow screen — the line above is the one that must survive the truncate. */}
        <Link
          href={UTILITY_BAR.right.href}
          className="hidden shrink-0 font-semibold text-white transition-colors hover:text-brand-200 sm:inline"
        >
          {UTILITY_BAR.right.label}
        </Link>
      </Container>
    </div>
  );
}
