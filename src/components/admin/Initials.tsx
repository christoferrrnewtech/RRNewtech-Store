/**
 * A round initials badge for a person — customers in the queues, teammates in the team list.
 *
 * The colour is derived from the name, so the same person always gets the same one and a list of
 * rows is easier to scan than a column of identical grey circles.
 */
const PALETTE = [
  "bg-brand-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
];

export function Initials({
  name,
  size = "md",
  hideOnPhone = true,
}: {
  name: string;
  size?: "md" | "lg";
  /** Queue rows drop it on a phone to give the text room; elsewhere it stays. */
  hideOnPhone?: boolean;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;

  return (
    <span
      aria-hidden="true"
      className={`shrink-0 items-center justify-center rounded-full font-bold text-white ${
        hideOnPhone ? "hidden sm:inline-flex" : "inline-flex"
      } ${
        PALETTE[hash % PALETTE.length]
      } ${size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs"}`}
    >
      {initials}
    </span>
  );
}
