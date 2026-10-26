/**
 * Product descriptions are stored as a flat `string[]` of paragraphs, but almost all of the copy
 * was pasted in already-formatted — with literal "Description:" / "Highlights:" labels, headings,
 * and bullet lines that had nowhere structured to live. Rendered as plain <p>s they read as a wall
 * of disconnected fragments.
 *
 * This turns those conventions back into structure at display time. Every rule is narrow and
 * anything unmatched falls through to a paragraph, i.e. exactly the old output — so copy that
 * doesn't follow a convention is never mangled.
 *
 * Links use the markdown form `[View the brochure](https://…)`: inline within a line they render as
 * a text link, and a line holding nothing but a link renders as a button.
 */

export type DescriptionLink = { text: string; href: string };

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  /** Lines that are nothing but a link, shown as buttons ("View the brochure"). */
  | { type: "links"; items: DescriptionLink[] };

/** A text run inside a line: plain text, or a `[label](url)` link. */
export type InlineSegment = { type: "text"; text: string } | ({ type: "link" } & DescriptionLink);

/**
 * `[label](url)` — the label is what shoppers see, the url is where it goes. A space between the
 * two halves is tolerated, since "[label] (url)" is an easy slip to make when typing one by hand.
 */
const LINK = /\[([^\]\n]+)\][ \t]*\(\s*([^)\s]+)\s*\)/g;
const LINK_ONLY = /^\[([^\]\n]+)\][ \t]*\(\s*([^)\s]+)\s*\)$/;

/**
 * The href to use for a link the admin typed, or null if it isn't one we'll render. Only web,
 * mail and phone links (and on-site paths) are allowed, so a `javascript:` url can't sneak in.
 * A bare "www." address gets https:// since that's how people usually paste them.
 */
export function safeHref(url: string): string | null {
  const value = url.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  if (/^www\.\S+$/i.test(value)) return `https://${value}`;
  if (/^(?:mailto|tel):\S+$/i.test(value)) return value;
  if (/^\/(?!\/)\S*$/.test(value)) return value;
  return null;
}

/**
 * How a link opens in the on-page PDF viewer instead of a new tab. `src` is what the viewer loads:
 * Drive files go through our own route (Drive sends no CORS headers, so the browser can't fetch
 * them directly); a direct PDF link is loaded as-is.
 */
export type DocumentViewer = { kind: "drive" | "pdf"; src: string };

/** Drive file links: `/file/d/<id>/view`, `/open?id=<id>`, `/uc?id=<id>&export=download`. */
const DRIVE_FILE = /^\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/;
export const DRIVE_ID = /^[\w-]{10,}$/;

function parseHref(href: string): URL | null {
  try {
    // The base only resolves on-site paths like "/files/brochure.pdf"; it's never used as a src.
    const url = new URL(href, "https://site.invalid");
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** The Drive file id a link points at, or null if it isn't a Drive file link. */
export function driveFileId(href: string): string | null {
  const url = parseHref(href);
  if (url?.hostname !== "drive.google.com") return null;
  const id = DRIVE_FILE.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  return id && DRIVE_ID.test(id) ? id : null;
}

/** The viewer for a (safe) href, or null if it's not a document we can show on the page. */
export function documentViewer(href: string): DocumentViewer | null {
  const url = parseHref(href);
  if (!url) return null;

  if (url.hostname === "drive.google.com") {
    const id = driveFileId(href);
    return id ? { kind: "drive", src: `/api/documents/drive/${id}` } : null;
  }

  // Firebase Storage puts the object path in one percent-encoded segment (…/o/docs%2Fspec.pdf).
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed escapes — test the raw path.
  }
  return /\.pdf$/i.test(path) ? { kind: "pdf", src: href } : null;
}

/** Splits a line into text and links. Anything whose url we won't render stays exactly as typed. */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
    const href = safeHref(match[2]);
    segments.push(
      href ? { type: "link", text: match[1], href } : { type: "text", text: match[0] },
    );
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

/** The line as plain text — links reduced to their labels — for places that can't show a link. */
export function stripLinks(text: string): string {
  return text.replace(LINK, (whole, label: string, url: string) => (safeHref(url) ? label : whole));
}

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

    // A line that is only a link becomes a button; consecutive ones sit together in a row.
    const linkOnly = LINK_ONLY.exec(line);
    const linkHref = linkOnly && safeHref(linkOnly[2]);
    if (linkOnly && linkHref) {
      const link = { text: linkOnly[1].trim(), href: linkHref };
      const last = blocks[blocks.length - 1];
      if (last?.type === "links") last.items.push(link);
      else blocks.push({ type: "links", items: [link] });
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
