import type { ReactNode } from "react";

/** Centered max-width page container with consistent horizontal padding. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["mx-auto w-full max-w-6xl px-4 sm:px-6", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
