/**
 * HubSpot CRM sync for inquiries — SERVER ONLY.
 *
 * Every inquiry upserts a HubSpot contact keyed on email, so a repeat enquirer updates one record
 * instead of piling up duplicates. The form decides how far along they are:
 *
 *   - "message" (/contact)        → a contact; lifecycle stage left alone.
 *   - "quote"   (/request-quote)  → a contact with lifecyclestage = "lead".
 *
 * Firestore stays the source of truth — `kind` on the stored inquiry is the same contact/lead split.
 * HubSpot is a mirror for sales, so like `sendEmail` this is NEVER FATAL: it returns false and logs.
 *
 * Plain `fetch` rather than `@hubspot/api-client`, for the same reason as email.ts and paymongo.ts.
 *
 * The site BUILDS AND RUNS with HUBSPOT_ACCESS_TOKEN unset: the sync is skipped with a log line.
 * The token is a Service Key (or Legacy private app token) with crm.objects.contacts.read/write —
 * NOT a Personal Access Key, which only signs in the HubSpot CLI.
 */

import "server-only";
import type { Inquiry } from "@/lib/inquiries";

const API_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert";

/** Awaited inline beside the staff email, on the way to the thank-you page — see email.ts. */
const TIMEOUT_MS = 8_000;

export function isHubSpotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

/** "Juan dela Cruz" → firstname "Juan", lastname "dela Cruz". One word is a first name only. */
function splitName(name: string): { firstname: string; lastname: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { firstname: first, lastname: rest.join(" ") };
}

type UpsertResult = { ok: boolean; status: number; detail: string };

async function upsertContact(email: string, properties: Record<string, string>): Promise<UpsertResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: [{ idProperty: "email", id: email, properties }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  // A batch call can answer 207 with the one input we sent sitting in `errors`, so `res.ok` alone
  // would count a rejected contact as synced.
  const ok = res.ok && res.status !== 207;
  return { ok, status: res.status, detail: ok ? "" : await res.text().catch(() => "") };
}

/** Create or update the inquiry's HubSpot contact. Returns true when HubSpot accepted it; never throws. */
export async function syncInquiryToHubSpot(inquiry: Inquiry): Promise<boolean> {
  if (!isHubSpotConfigured()) {
    console.warn(`[hubspot] HUBSPOT_ACCESS_TOKEN is not set — skipped ${inquiry.ref}`);
    return false;
  }

  const core: Record<string, string> = {
    email: inquiry.email,
    ...splitName(inquiry.name),
    ...(inquiry.phone ? { phone: inquiry.phone } : {}),
    ...(inquiry.clinic ? { company: inquiry.clinic } : {}),
  };
  // Nice to have, and the two ways a valid upsert gets refused: HubSpot won't move a lifecycle
  // stage backwards (a "customer" asking for a quote is not demoted to "lead"), and `message` is a
  // default property an account admin can delete. Either one 400s the whole input, so a refusal is
  // retried with `core` alone — the person still lands in the CRM.
  const extra: Record<string, string> = {
    message: inquiry.product
      ? `[${inquiry.ref}] Re: ${inquiry.product.name}\n\n${inquiry.message}`
      : `[${inquiry.ref}] ${inquiry.message}`,
    ...(inquiry.kind === "quote" ? { lifecyclestage: "lead" } : {}),
  };

  try {
    let result = await upsertContact(inquiry.email, { ...core, ...extra });
    if (!result.ok && (result.status === 400 || result.status === 207)) {
      console.warn(`[hubspot] ${inquiry.ref} refused with extras, retrying core only: ${result.detail}`);
      result = await upsertContact(inquiry.email, core);
    }
    if (!result.ok) {
      console.error(`[hubspot] HubSpot refused ${inquiry.ref} (${result.status}): ${result.detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[hubspot] could not reach HubSpot for ${inquiry.ref}:`, err);
    return false;
  }
}
