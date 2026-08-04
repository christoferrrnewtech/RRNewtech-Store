import { parseDescription } from "@/lib/product-description";

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
              {block.text}
            </h3>
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
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
