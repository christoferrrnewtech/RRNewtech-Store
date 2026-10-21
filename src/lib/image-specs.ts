/**
 * Recommended upload size for each admin image field, shown beside the picker by `ImageInput`.
 *
 * Sizes are ~2× the largest the storefront ever draws the image, so it stays sharp on high-DPI
 * screens, in the shape of the frame it's shown in so nothing important is cropped. Banners are
 * stored up to 3000 × 1110 (BANNER_IMAGE_BOX in the admin actions); everything else up to 1600px.
 */
export type ImageSpec = { size: string; tip: string };

export const IMAGE_SPECS = {
  banner: {
    size: "2978 × 1102 px (2.7:1)",
    tip: "Saved up to 3000 × 1110 at 90% quality. The homepage trims the sides on smaller screens, so keep text and products near the centre. Export as JPG to stay under 5 MB.",
  },
  brandHero: {
    size: "2978 × 1102 px (2.7:1)",
    tip: "Saved up to 3000 × 1110 at 90% quality. The brand page shows it full-width at exactly 2.7:1, so this shape isn't cropped. Export as JPG to stay under 5 MB.",
  },
  logo: {
    size: "1200 × 675 px (16:9)",
    tip: "Transparent PNG with the logo centred and a little space around it. It's fitted inside both square and wide tiles, never cropped.",
  },
  brandGallery: {
    size: "1200 × 900 px (4:3)",
    tip: "Shown in 4:3 tiles on the brand page. Other shapes are cropped to fit.",
  },
  product: {
    size: "1200 × 1200 px (1:1)",
    tip: "Square, on a white background, with the product centred. Listing cards and the product page both show it square.",
  },
  category: {
    size: "1280 × 800 px (16:10)",
    tip: "Shown as a 16:10 tile with the category name over the bottom, so keep the subject in the upper part.",
  },
  about: {
    size: "1200 × 900 px (4:3)",
    tip: "Shown at 4:3 beside the About text. Other shapes are cropped to fit.",
  },
  session: {
    size: "1600 × 1000 px (16:10)",
    tip: "Session cards crop to 16:10 and the session page shows the whole photo, so this shape looks right in both.",
  },
} satisfies Record<string, ImageSpec>;
