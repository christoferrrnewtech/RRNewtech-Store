/**
 * Circular prev/next control for horizontal scrollers (brand rails, gallery thumbnails).
 *
 * Hidden below `sm` on purpose — touch users swipe, so the arrows would just cover content.
 * Pass `subject` to keep the screen-reader label accurate for what's being scrolled.
 */
export function ArrowButton({
  dir,
  onClick,
  disabled = false,
  subject = "products",
  className,
}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
  subject?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Scroll ${subject} ${dir}`}
      className={[
        "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex",
        "bg-brand-600 text-white shadow-md transition-colors hover:bg-brand-700",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-brand-600",
        className ?? "",
      ].join(" ")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
