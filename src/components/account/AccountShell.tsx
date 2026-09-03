import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/**
 * The framed card every account screen sits in — sign in, register, and the "check your email"
 * notice. Keeping the chrome here means those three pages differ only by their form.
 */
const WIDTHS = {
  narrow: "max-w-md",
  wide: "max-w-2xl",
  full: "max-w-4xl",
} as const;

export function AccountShell({
  title,
  subtitle,
  width = "narrow",
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /**
   * `narrow` for the single-column forms, `wide` for the register form, `full` for the account
   * dashboard, whose order rows and address cards need the room.
   */
  width?: "narrow" | "wide" | "full";
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="flex flex-1 justify-center py-12 sm:py-16">
      <div className={`w-full ${WIDTHS[width]}`}>
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>

        {/* The dashboard composes its own cards, so it opts out of the single framed panel. */}
        {width === "full" ? (
          <div className="mt-8">{children}</div>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">{children}</div>
        )}

        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </Container>
  );
}

/** The "no account yet?" / "already registered?" line under the card. */
export function AccountShellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-700 hover:text-brand-800">
      {children}
    </Link>
  );
}
