/**
 * Transactional email through Resend — SERVER ONLY.
 *
 * Plain `fetch` against the REST API rather than the `resend` SDK, for the same reason paymongo.ts
 * does it: one POST endpoint doesn't justify a dependency, and owning the request means owning the
 * timeout.
 *
 * NEVER FATAL. Every caller is finishing something more important — an inquiry already written, a
 * payment already recorded — so `sendEmail` reports failure by returning false and logging, never
 * by throwing. A staff notification that didn't go out is recoverable from the admin; a webhook
 * that 500s because Resend hiccuped earns a redelivery, and a customer told "something went wrong"
 * after paying is not.
 *
 * The site BUILDS AND RUNS with RESEND_API_KEY / EMAIL_FROM unset: sends are skipped with a log
 * line, exactly as PayMongo degrades when its keys are empty.
 */

import "server-only";

const API_URL = "https://api.resend.com/emails";

/**
 * Short on purpose. Sends are awaited inline (see notifications.ts for why not `after()`), and one
 * of those callers is the page a customer lands on straight after paying — a hung Resend must not
 * hold that page for longer than this.
 */
const TIMEOUT_MS = 8_000;

export type Email = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Where a staff member's "Reply" goes — the customer, so they can answer in one click. */
  replyTo?: string;
  /**
   * Resend drops a second send with the same key for 24 hours. The callers already send once by
   * construction (an inquiry is created once; `applyOrderPayment` reports `paid` once), so this is
   * a backstop against a retried request rather than the guarantee itself.
   */
  idempotencyKey?: string;
};

/**
 * Both are required. The key alone isn't enough: Resend only delivers to arbitrary inboxes from a
 * domain verified on the account, so there is no safe default sender to fall back to.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Send one email. Returns true when Resend accepted it; never throws. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] RESEND_API_KEY or EMAIL_FROM is not set — skipped "${email.subject}"`);
    return false;
  }
  if (email.to.length === 0) return false;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      // Resend's body names the problem precisely ("domain is not verified", "invalid `to`") —
      // worth having in the log, since a misconfigured sender is the likeliest failure here.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend refused "${email.subject}" (${res.status}): ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] could not reach Resend for "${email.subject}":`, err);
    return false;
  }
}
