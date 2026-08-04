/**
 * Product descriptions are stored as a flat `string[]` of paragraphs, but almost all of the copy
 * was pasted in already-formatted — with literal "Description:" / "Highlights:" labels, headings,
 * and bullet lines that had nowhere structured to live. Rendered as plain <p>s they read as a wall
 * of disconnected fragments.
 *
 * This turns those conventions back into structure at display time. Every rule is narrow and
 * anything unmatched falls through to a paragraph, i.e. exactly the old output — so copy that
 * doesn't follow a convention is never mangled.
 */

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/** Leading bullet glyph plus its optional emoji variation selector, e.g. "✔️ ", "• ", "- ". */
const BULLET = /^(?:[✔✓•●▪‣·*+]|[-–—])️?\s+/u;

/** "Description: real text" — the label is noise, the text is the paragraph. */
const INLINE_LABEL = /^(?:description|overview)\s*:\s*(\S.*)$/i;

/** A line that is nothing but a short label and a colon, e.g. "Highlights:". */
const BARE_LABEL = /^([^:]{1,40}):$/;

/** Headings whose following lines are a list even when nobody typed a bullet glyph. */
const LIST_HEADING =
  /^(?:highlights?|key features?|features?|specs?|specifications?|includes?|what'?s inside|why you'?ll love it|benefits?)\b/i;

/** Past this, a line is prose that happens to sit under a list heading — not a bullet. */
const MAX_BULLET_LENGTH = 200;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function parseDescription(
  paragraphs: string[] | undefined,
  productName?: string,
): DescriptionBlock[] {
  const lines = (paragraphs ?? []).map((p) => String(p).trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // The first line often just repeats the product title, which the page already shows.
  if (productName && normalize(lines[0]) === normalize(productName)) lines.shift();

  const blocks: DescriptionBlock[] = [];
  // True while we're inside a section whose heading implies a list.
  let inListSection = false;

  const pushItem = (text: string) => {
    const last = blocks[blocks.length - 1];
    if (last?.type === "list") last.items.push(text);
    else blocks.push({ type: "list", items: [text] });
  };

  const pushHeading = (text: string) => {
    blocks.push({ type: "heading", text });
    inListSection = LIST_HEADING.test(text);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    const inline = INLINE_LABEL.exec(line);
    if (inline) {
      blocks.push({ type: "paragraph", text: inline[1] });
      inListSection = false;
      continue;
    }

    const bare = BARE_LABEL.exec(line);
    if (bare) {
      pushHeading(bare[1].trim());
      continue;
    }

    if (BULLET.test(line)) {
      pushItem(line.replace(BULLET, "").trim());
      continue;
    }

    // Unmarked lines under a list heading are the list — that's the shape most of the copy uses.
    if (inListSection && line.length <= MAX_BULLET_LENGTH) {
      pushItem(line);
      continue;
    }

    // A short, unpunctuated lead-in immediately followed by a bullet is a heading
    // ("Why You'll Love It", "What's Inside?"). Requiring the bullet keeps this tight enough
    // that ordinary short sentences don't get promoted.
    if (line.length < 60 && !/[.!]$/.test(line) && next && BULLET.test(next)) {
      pushHeading(line);
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
    inListSection = false;
  }

  return blocks;
}
