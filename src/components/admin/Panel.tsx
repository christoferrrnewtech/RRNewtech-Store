import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Page chrome shared by every admin screen: the page header and the card ("panel") that content
 * sits in. Server-safe — no hooks — so both server pages and client editors can use them.
 *
 * Every admin page used to write its own <h1>, intro paragraph and card markup, and they had
 * drifted: actions in different corners, three-line intros, cards with different padding. One
 * header and one panel keep the screens reading as one tool.
 */

export function PageHeader({
  title,
  description,
  back,
  badges,
  actions,
}: {
  title: ReactNode;
  /** One or two short sentences. Anything longer belongs in a panel's own description. */
  description?: ReactNode;
  /** "← All orders" above the title, for detail pages. */
  back?: { href: string; label: string };
  /** Status pills shown beside the title. */
  badges?: ReactNode;
  /** Buttons on the right; they wrap under the title on a phone. */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand-700"
        >
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-fg">
              {title}
            </h1>
            {badges}
          </div>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A titled card. `footer` is the grey strip along the bottom, for a panel's own buttons.
 *
 * Deliberately no `overflow-hidden`: a `SaveBar` inside must be able to stick to the viewport
 * bottom, and an overflow-clipping ancestor would stop it.
 */
export function Panel({
  title,
  description,
  actions,
  footer,
  tone = "default",
  padded = true,
  className = "",
  id,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
  /** false for flush content — a row list that runs edge to edge. */
  padded?: boolean;
  className?: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-2xl border bg-surface ${
        tone === "danger" ? "border-danger/30" : "border-line"
      } ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2
                className={`text-base font-semibold ${tone === "danger" ? "text-danger" : "text-fg"}`}
              >
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>}
      {footer && (
        <div className="flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-line bg-bg/60 px-5 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

/** A labelled group of fields inside a long form: a small heading, a hint, then the fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-line pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left w-full">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-700">
          {title}
        </span>
        {description && (
          <span className="mt-1 block text-sm font-normal text-muted">{description}</span>
        )}
      </legend>
      <div className="clear-both space-y-5 pt-4">{children}</div>
    </fieldset>
  );
}

/** Label/value pairs for read-only facts on a detail page. */
export function DetailList({
  items,
}: {
  items: { label: string; value: ReactNode; hidden?: boolean }[];
}) {
  return (
    <dl className="space-y-3.5 text-sm">
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-medium text-muted">{item.label}</dt>
            <dd className="mt-0.5 break-words text-fg">{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Small "+ Add" / secondary actions that sit in a panel header. */
export function PanelLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="text-sm font-semibold text-brand-700 hover:text-brand-800"
    >
      {children}
    </Link>
  );
}
