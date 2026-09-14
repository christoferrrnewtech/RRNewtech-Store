/**
 * Helpers for links an admin typed by hand — session CTAs, banner CTAs and the like.
 *
 * Client-safe: only `SITE` is imported, which client components already use.
 */

import { SITE } from "@/lib/constants";

/**
 * A hand-typed link, made safe to render.
 *
 * A path that forgot its leading slash ("brands/durr-dental") is a *relative* URL: the browser
 * resolves it against the current page and lands on /education-training/brands/... — a 404 that
 * looks like a broken site rather than a typo. Anything not already absolute, root-relative, a
 * scheme link or a fragment gets the slash it meant to have.
 */
export function safeHref(href: string): string {
  return /^([a-z]+:|\/|#)/i.test(href) ? href : `/${href}`;
}

/**
 * Does this link leave our site?
 *
 * Only an http(s) URL on another host counts. Root-relative paths and fragments stay here by
 * definition, and `mailto:`/`tel:` hand off to another app entirely — opening a blank tab for those
 * just litters the browser. A URL pointing back at our own domain is treated as internal too.
 *
 * A malformed entry degrades to "internal" rather than throwing mid-render: a same-tab link is a
 * far smaller problem than a page that won't render.
 */
export function isExternalHref(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return new URL(href).hostname.replace(/^www\./i, "") !== SITE.domain;
  } catch {
    return false;
  }
}

/**
 * Spread onto a link to send external destinations to a new tab and leave internal ones alone:
 *
 *     <LinkButton href={url} {...externalLinkProps(url)}>
 */
export function externalLinkProps(
  href: string,
): { target: "_blank"; rel: string } | Record<string, never> {
  return isExternalHref(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
