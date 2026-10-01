/**
 * The branded shell every staff email is rendered into — SERVER ONLY.
 *
 * Email HTML is its own dialect: no CSS variables, no flexbox, `<style>` blocks stripped by some
 * clients, and Outlook rendering through Word. So this is tables and inline styles throughout, and
 * the palette is COPIED from the @theme tokens in globals.css rather than referenced — keep the
 * two in step by hand. Same rules as the site, though: Primary Blue for the brand band and the one
 * action, Charcoal for text, hairline borders, squared-off 2–4px corners, amber never used.
 *
 * DM Sans is offered through a Google Fonts <link>, which Apple Mail and iOS honour; Gmail and
 * Outlook ignore it and fall back to Arial, which is close enough in width not to reflow anything.
 *
 * EVERYTHING INTERPOLATED FROM A CUSTOMER GOES THROUGH `esc`. Inquiry and checkout fields are typed
 * by strangers, and an unescaped `<a href>` in a staff inbox is a phishing link with our logo on it.
 */

import "server-only";
import { SITE } from "@/lib/constants";

/** Mirrors globals.css. */
export const C = {
  bg: "#f7f8fc",
  surface: "#ffffff",
  surface2: "#eef0f9",
  ink: "#2d3791",
  fg: "#151515",
  muted: "#5a5f6e",
  mutedLight: "#8a8f9c",
  line: "#e2e4ec",
  brand200: "#b6bde6",
  success: "#059669",
  successBg: "#e6f6f0",
  danger: "#dc2626",
  dangerBg: "#fdecec",
} as const;

/**
 * Every link and image in a staff email points at the LIVE site, never `SITE.url`. An email is
 * opened long after it is sent, by staff who work in the live admin — and a send from a dev
 * machine would otherwise carry its NEXT_PUBLIC_SITE_URL (localhost, or rrnewtech.web.app, which
 * doesn't serve /brand at all). Local dev writes to the same Firebase project, so the live admin
 * opens any record a test send links to.
 */
export const LIVE_URL = `https://${SITE.domain}`;

export const FONT = "'DM Sans', Arial, Helvetica, sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with the customer's own line breaks kept. */
export function escLines(value: string): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

const whenFmt = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

/** Epoch ms → "Oct 1, 2026, 3:42 PM", always Manila time — the team reads it there. */
export function formatWhen(ms: number): string {
  return ms ? whenFmt.format(new Date(ms)) : "—";
}

export type Tone = "brand" | "success" | "danger";

const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: C.ink, bg: C.surface2 },
  success: { fg: C.success, bg: C.successBg },
  danger: { fg: C.danger, bg: C.dangerBg },
};

/** The small squared status chip — the email's version of the admin's status badges. */
export function chip(label: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `<span style="display:inline-block;padding:4px 8px;border-radius:2px;background:${t.bg};color:${t.fg};font:700 11px/1.2 ${FONT};letter-spacing:0.08em;text-transform:uppercase;">${esc(label)}</span>`;
}

export function link(href: string, label: string): string {
  return `<a href="${esc(href)}" style="color:${C.ink};text-decoration:underline;">${esc(label)}</a>`;
}

/** A small uppercase section label over a hairline, the way the admin's detail panels are headed. */
export function section(title: string, inner: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
  <tr><td style="padding-bottom:10px;border-bottom:1px solid ${C.line};font:700 11px/1.2 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${C.muted};">${esc(title)}</td></tr>
  <tr><td style="padding-top:12px;">${inner}</td></tr>
</table>`;
}

/**
 * Label/value rows. Values are HTML (so they can carry links) — callers escape them; rows with an
 * empty value are dropped rather than rendered as a dangling label.
 */
export function details(rows: [label: string, valueHtml: string][]): string {
  const body = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
  <tr>
    <td valign="top" width="120" style="padding:5px 12px 5px 0;font:500 13px/1.5 ${FONT};color:${C.mutedLight};">${esc(label)}</td>
    <td valign="top" style="padding:5px 0;font:400 14px/1.5 ${FONT};color:${C.fg};">${value}</td>
  </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>`;
}

/** A call-out panel — the customer's message, a warning. Left rule in the tone's colour. */
export function panel(innerHtml: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background:${t.bg};border-left:3px solid ${t.fg};padding:14px 16px;font:400 14px/1.6 ${FONT};color:${C.fg};">${innerHtml}</td></tr>
</table>`;
}

/**
 * Wrap a body in the brand shell: Primary Blue band with the white logo, white card, footer.
 *
 * The logo is the transparent white cut the site footer uses, on the same #2d3791 — the shipped
 * rnr-logo.png bakes in its own #003da5 plate, which would sit as a visible box on the band.
 */
export function renderLayout(input: {
  /** <title>, and what a screen reader announces first. */
  title: string;
  /** The grey line after the subject in an inbox list. */
  preheader: string;
  chips: string;
  heading: string;
  /** Plain text under the heading. */
  intro?: string;
  body: string;
  cta: { label: string; href: string };
  /** Small print above the company line — e.g. what replying does. */
  footerNote: string;
}): string {
  const logo = `${LIVE_URL}/brand/rnr-logo-white.png`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(input.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td class="px" style="background:${C.ink};padding:20px 32px;border-radius:4px 4px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle"><img src="${esc(logo)}" width="160" height="37" alt="${esc(SITE.name)}" style="display:block;border:0;outline:none;width:160px;height:37px;color:#ffffff;font:700 16px ${FONT};"></td>
                <td valign="middle" align="right" style="font:700 11px/1.2 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${C.brand200};">Store notification</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="background:${C.surface};border:1px solid ${C.line};border-top:0;border-radius:0 0 4px 4px;padding:32px;">
            <div>${input.chips}</div>
            <h1 style="margin:14px 0 0;font:700 24px/1.25 ${FONT};color:${C.fg};letter-spacing:-0.01em;">${esc(input.heading)}</h1>
            ${input.intro ? `<p style="margin:6px 0 0;font:400 15px/1.5 ${FONT};color:${C.muted};">${esc(input.intro)}</p>` : ""}
            ${input.body}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td style="background:${C.ink};border-radius:2px;">
                  <a href="${esc(input.cta.href)}" style="display:inline-block;padding:13px 22px;font:700 14px/1 ${FONT};color:#ffffff;text-decoration:none;">${esc(input.cta.label)} &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:20px 32px;font:400 12px/1.6 ${FONT};color:${C.mutedLight};">
            ${esc(input.footerNote)}<br>
            ${esc(SITE.legalName)} &middot; ${esc(SITE.addressLine)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
