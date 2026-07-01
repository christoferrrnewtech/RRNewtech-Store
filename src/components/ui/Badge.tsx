import type { ReactNode } from "react";

type Tone = "brand" | "sale" | "muted" | "danger";

const tones: Record<Tone, string> = {
  brand: "bg-surface-2 text-brand-700",
  sale: "bg-accent-light text-accent",
  muted: "bg-elevated text-muted",
  danger: "bg-red-50 text-danger",
};

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
