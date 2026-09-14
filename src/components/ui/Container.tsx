import type { ReactNode } from "react";

/**
 * Centered max-width page container with consistent horizontal padding — the storefront's single
 * width authority, so every section lines up on the same two vertical edges.
 *
 * `max-w-7xl` (1280px) puts content at ~82% of a 1500px viewport. The narrower `max-w-6xl` it
 * replaced left the page visibly short of both margins.
 */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["mx-auto w-full max-w-7xl px-4 sm:px-6", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
