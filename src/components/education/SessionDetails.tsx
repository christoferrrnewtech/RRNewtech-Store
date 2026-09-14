"use client";

import { useState } from "react";
import { NAV_ICONS } from "@/components/layout/NavIcons";

/**
 * How much of a campaign a card shows before it offers to expand. Both budgets come from the
 * VistaVox campaign, the reference for a comfortably-sized card: a summary of about three lines and
 * five one-line highlights. A campaign at or under that never sees a toggle.
 */
const SUMMARY_CHARS = 170;
const MAX_HIGHLIGHT_LINES = 5;

/**
 * Roughly how many characters fit on one line of a highlight: card width at the 3-up breakpoint,
 * less the padding and the check icon, at `text-sm`. Wider breakpoints fit more, so this errs
 * towards showing one item fewer rather than overflowing the budget.
 */
const CHARS_PER_LINE = 46;

/**
 * The highlights that fit in the line budget.
 *
 * Counting ITEMS isn't enough: five items that each wrap to two lines are twice the height of
 * VistaVox's five one-liners, which is exactly how the Curaprox campaign still towered over the row
 * after the first attempt at this. So each item is charged for the lines it will actually occupy.
 *
 * The first item always survives, even if it alone blows the budget — a collapsed list showing
 * nothing at all would read as a rendering fault.
 */
function withinLineBudget(highlights: string[]): string[] {
  const out: string[] = [];
  let lines = 0;
  for (const h of highlights) {
    const cost = Math.max(1, Math.ceil(h.length / CHARS_PER_LINE));
    if (out.length > 0 && lines + cost > MAX_HIGHLIGHT_LINES) break;
    out.push(h);
    lines += cost;
    if (lines >= MAX_HIGHLIGHT_LINES) break;
  }
  return out;
}

/**
 * The body of a campaign card — summary, highlight list, and a disclosure when there's more than a
 * card should show at rest.
 *
 * This exists because campaigns vary enormously: one is three lines, another pastes its entire
 * joining procedure into `highlights`. Left alone the long one stretches every card in its grid row
 * and leaves the short ones half empty; truncating it instead put content out of reach. Collapsing
 * gives every card the same resting height and still keeps everything readable.
 *
 * Whether to OFFER the toggle is decided by character count rather than by measuring the rendered
 * text: measuring needs a layout effect, so the button would flicker in after hydration. The clamp
 * itself is CSS and stays honest at any width — the count only gates the button.
 */
export function SessionDetails({
  summary,
  highlights = [],
}: {
  summary?: string;
  highlights?: string[];
}) {
  const [open, setOpen] = useState(false);
  const Check = NAV_ICONS.check;

  const fitted = withinLineBudget(highlights);
  const overflows = fitted.length < highlights.length || (summary?.length ?? 0) > SUMMARY_CHARS;
  const collapsed = overflows && !open;
  const shown = collapsed ? fitted : highlights;

  return (
    <>
      {summary && (
        <p
          className={[
            "mt-3 text-sm leading-relaxed text-muted",
            collapsed ? "line-clamp-3" : "",
          ].join(" ")}
        >
          {summary}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {shown.map((h, i) => (
            <li key={`${i}-${h}`} className="flex gap-2 text-sm leading-relaxed text-fg">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600" />
              {h}
            </li>
          ))}
        </ul>
      )}

      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 self-start text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
