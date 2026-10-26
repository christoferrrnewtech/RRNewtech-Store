import type { ReactNode } from "react";
import { documentViewer, parseDescription, parseInline } from "@/lib/product-description";
import { DocumentButton } from "./DocumentButton";

/** Off-site links open in a new tab so the shopper keeps their place on the product page. */
function linkTarget(href: string) {
  return /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/** A description link. PDFs and Drive files open in the on-page viewer; anything else is a plain link.
 *  `className` must work on a <button> as well as an <a>. */
function DescriptionLink({
  href,
  title,
  className,
  children,
}: {
  href: string;
  title: string;
  className: string;
  children: ReactNode;
}) {
  const viewer = documentViewer(href);
  if (viewer) {
    return (
      <DocumentButton viewer={viewer} title={title} className={className}>
        {children}
      </DocumentButton>
    );
  }
  return (
    <a href={href} {...linkTarget(href)} className={className}>
      {children}
    </a>
  );
}

/** A line's text with any `[label](url)` links rendered as real links. */
function InlineText({ text }: { text: string }) {
  return parseInline(text).map((seg, i) =>
    seg.type === "link" ? (
      <DescriptionLink
        key={i}
        href={seg.href}
        title={seg.text}
        className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
      >
        {seg.text}
      </DescriptionLink>
    ) : (
      seg.text
    ),
  );
}

/** Icon paths (24×24, stroked) for the kinds of link a card can hold. */
const LINK_ICONS = {
  // Document — brochures, spec sheets, Drive folders: most of what gets linked.
  web: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  tel: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
};

/** The small grey line under a card's title, telling the shopper where the link goes. */
function linkHint(href: string): { icon: keyof typeof LINK_ICONS; hint?: string } {
  if (/^mailto:/i.test(href)) return { icon: "mail", hint: "Opens your email app" };
  if (/^tel:/i.test(href)) return { icon: "tel", hint: "Tap to call" };
  const viewer = documentViewer(href);
  if (viewer?.kind === "drive") return { icon: "web", hint: "Opens a preview · Google Drive" };
  if (viewer) {
    const host = /^https?:\/\//i.test(href) ? new URL(href).hostname.replace(/^www\./, "") : "";
    return { icon: "web", hint: host ? `PDF · Opens a preview · ${host}` : "PDF · Opens a preview" };
  }
  if (/^https?:\/\//i.test(href)) {
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      return { icon: "web", hint: `Opens in a new tab · ${host}` };
    } catch {
      return { icon: "web", hint: "Opens in a new tab" };
    }
  }
  return { icon: "web" };
}

/**
 * A line that is only a link ("View the brochure") — a tinted card rather than a plain button, so
 * it reads as a resource to open and doesn't get lost in the description or compete with the solid
 * blue Add to cart button. PDFs and Drive files open in the on-page viewer rather than a new tab.
 */
function LinkCard({ text, href }: { text: string; href: string }) {
  const { icon, hint } = linkHint(href);
  return (
    <DescriptionLink
      href={href}
      title={text}
      className="group flex w-full items-center gap-4 rounded-2xl text-left border border-brand-200 bg-brand-50 p-4 transition-colors hover:border-brand-600 hover:bg-brand-100"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={LINK_ICONS[icon]}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-fg group-hover:text-brand-700">
          {text}
        </span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </DescriptionLink>
  );
}

/**
 * The body of the "Product details" section, shared by the brand PDP and the catalog PDP.
 *
 * Descriptions are stored as flat paragraph arrays but were pasted in already-formatted, so this
 * runs them through {@link parseDescription} to recover headings and bullet lists. Bullets reuse
 * the same checkmark mark as the highlights list in the buy column, so the two read as one system.
 */
export function ProductDescription({
  description,
  name,
}: {
  description?: string[];
  name?: string;
}) {
  const blocks = parseDescription(description, name);
  if (blocks.length === 0) return null;

  return (
    <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3
              key={i}
              className={[
                "font-[family-name:var(--font-display)] text-base font-bold text-fg",
                i === 0 ? "" : "pt-4",
              ].join(" ")}
            >
              <InlineText text={block.text} />
            </h3>
          );
        }

        if (block.type === "links") {
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              {block.items.map((link) => (
                <LinkCard key={`${link.href}|${link.text}`} {...link} />
              ))}
            </div>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={i} className="grid gap-2">
              {block.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-base text-fg">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-1 shrink-0 text-brand-600"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12l4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    <InlineText text={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
