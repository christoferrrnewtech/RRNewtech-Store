import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

/** Inquiry refs as `makeRef("INQ")` mints them. Anything else in `?ref=` is ignored. */
const INQUIRY_REF = /^INQ-[A-Z0-9]{6}$/;

/** `?ref=` if it is shaped like a real inquiry reference, else undefined. */
export function inquiryRefParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && INQUIRY_REF.test(value) ? value : undefined;
}

/**
 * The confirmation shown on /contact/thank-you and /request-quote/thank-you — the card both forms
 * used to swap themselves for in place, now on its own URL so the conversion can be counted by it.
 *
 * The ref is only echoed back, never looked up: the page shows nothing about the inquiry beyond
 * the code the visitor can quote if they phone in.
 */
export function InquirySent({
  title,
  inquiryRef,
  cta,
  children,
}: {
  title: string;
  inquiryRef?: string;
  cta: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden="true">
            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
        {inquiryRef && (
          <p className="mt-4 text-sm text-muted">
            Your reference: <span className="font-semibold text-fg">{inquiryRef}</span>
          </p>
        )}
        <LinkButton href={cta.href} variant="secondary" className="mt-6">
          {cta.label}
        </LinkButton>
      </div>
    </Container>
  );
}
