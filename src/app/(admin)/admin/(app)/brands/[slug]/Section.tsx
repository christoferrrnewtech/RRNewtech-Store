import type { ReactNode } from "react";

/**
 * Consistent section frame: step badge, title, blurb, body — the admin `Panel` look, plus the
 * anchor id the section tabs jump to. Lives in its own module because both the main brand editor
 * and the separate Products page render it, and neither should import the other.
 *
 * Section forms end with a `SaveBar`, whose negative margins assume the body padding below.
 */
export function Section({
  id,
  step,
  title,
  hint,
  children,
}: {
  id: string;
  /** Position in the editor; omitted for sections outside the numbered flow (Visibility). */
  step?: number | string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // scroll-mt clears the sticky section-tab rail when jumping to an anchor.
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        {step !== undefined && (
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
            {step}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
