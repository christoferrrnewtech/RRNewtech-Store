import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "secondaryDark" | "inverse" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-line bg-surface text-fg hover:bg-elevated hover:border-line-strong",
  // Like `secondary` but with a border you can actually see — for a button that has to hold its own
  // beside a solid one, where the hairline `border-line` reads as no border at all.
  outline: "border border-brand-800 bg-surface text-fg hover:bg-brand-800 hover:text-white",
  secondaryDark:
    "border border-white/20 bg-transparent text-white/85 hover:border-white/40 hover:text-white",
  // White button with brand-blue text — for use on dark/blue panels.
  inverse: "bg-white text-brand-700 hover:bg-brand-50",
  ghost: "text-fg hover:text-brand-600",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

function classes(variant: Variant, size: Size, className?: string) {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
