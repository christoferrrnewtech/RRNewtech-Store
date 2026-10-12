/**
 * Per-slide look for the hero's overlay copy: text colors, text sizes, and each button's colors.
 *
 * Kept out of `content.ts` (which is server-only) because the admin editor needs the defaults and
 * the parser on the client too, for its live preview.
 */

export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra large",
};

/** Each preset still steps up from phone to desktop, so a big heading doesn't overflow a phone. */
export const HEADING_SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-3xl sm:text-4xl lg:text-5xl",
  md: "text-4xl sm:text-5xl lg:text-6xl",
  lg: "text-5xl sm:text-6xl lg:text-7xl",
  xl: "text-5xl sm:text-7xl lg:text-8xl",
};

export const BODY_SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-sm lg:text-base",
  md: "text-base lg:text-lg",
  lg: "text-lg lg:text-xl",
  xl: "text-xl lg:text-2xl",
};

export type ButtonColors = {
  text: string;
  background: string;
  /** Background while hovered. */
  hover: string;
};

export type BannerStyle = {
  eyebrowColor: string;
  headingColor: string;
  bodyColor: string;
  headingSize: TextSize;
  bodySize: TextSize;
  cta: ButtonColors;
  ctaAlt: ButtonColors;
};

/** R&R Primary Blue on light photos — what every slide looked like before styling was editable. */
export const BANNER_STYLE_DEFAULTS: BannerStyle = {
  eyebrowColor: "#3d49a6",
  headingColor: "#2d3791",
  bodyColor: "#1d2460",
  headingSize: "md",
  bodySize: "md",
  cta: { text: "#ffffff", background: "#2d3791", hover: "#252d78" },
  ctaAlt: { text: "#2d3791", background: "#ffffff", hover: "#eef0f9" },
};

const HEX = /^#[0-9a-f]{6}$/i;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function size(value: unknown, fallback: TextSize): TextSize {
  return TEXT_SIZES.includes(value as TextSize) ? (value as TextSize) : fallback;
}

function buttonColors(value: unknown, fallback: ButtonColors): ButtonColors {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    text: color(v.text, fallback.text),
    background: color(v.background, fallback.background),
    hover: color(v.hover, fallback.hover),
  };
}

/** A stored style with anything missing or malformed replaced by the default. */
export function toBannerStyle(value: unknown): BannerStyle {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = BANNER_STYLE_DEFAULTS;
  return {
    eyebrowColor: color(v.eyebrowColor, d.eyebrowColor),
    headingColor: color(v.headingColor, d.headingColor),
    bodyColor: color(v.bodyColor, d.bodyColor),
    headingSize: size(v.headingSize, d.headingSize),
    bodySize: size(v.bodySize, d.bodySize),
    cta: buttonColors(v.cta, d.cta),
    ctaAlt: buttonColors(v.ctaAlt, d.ctaAlt),
  };
}

/** The style fields posted by the banner editor's form. Shared by the save action and the preview. */
export function bannerStyleFromForm(form: FormData): BannerStyle {
  const get = (key: string) => form.get(key);
  return toBannerStyle({
    eyebrowColor: get("eyebrowColor"),
    headingColor: get("headingColor"),
    bodyColor: get("bodyColor"),
    headingSize: get("headingSize"),
    bodySize: get("bodySize"),
    cta: { text: get("ctaText"), background: get("ctaBg"), hover: get("ctaHover") },
    ctaAlt: { text: get("ctaAltText"), background: get("ctaAltBg"), hover: get("ctaAltHover") },
  });
}
