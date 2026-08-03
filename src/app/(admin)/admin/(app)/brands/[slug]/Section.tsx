import type { ReactNode } from "react";

/**
 * Consistent section frame: number, title, blurb, body. Lives in its own module because both the
 * main brand editor and the separate Products page render it, and neither should import the other.
 */
export function Section({
  id,
  step,
  title,
  hint,
  children,
}: {
  id: string;
  step: number | string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // scroll-mt clears the sticky section-tab rail when jumping to an anchor.
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-6">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-xs font-bold text-brand-600">{step}</span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-fg">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
