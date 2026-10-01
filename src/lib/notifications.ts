/**
 * Staff notification emails — SERVER ONLY.
 *
 * Two, to two different teams (see NOTIFY in constants.ts):
 *
 *   - a NEW INQUIRY goes to sales, the moment it is stored. Reply-To is the customer, so answering
 *     is one click.
 *   - a PAID ORDER goes to inventory, the moment it becomes paid — not when it is placed. An order
 *     is written as `awaiting_payment` before the customer ever reaches PayMongo, and most
 *     abandoned checkouts stay that way; telling inventory about those would train them to ignore
 *     the emails. `applyOrderPayment` is the one place that learns "paid" on every path (webhook,
 *     reconcile-on-read, the admin's re-check and mark-paid), and it reports it exactly once, so
 *     that is where this is called from. No Reply-To on these: a reply from inventory is far more
 *     likely meant for a colleague than for the customer.
 *
 * AWAITED, NOT `after()`. App Hosting runs on Cloud Run, which can throttle an instance's CPU once
 * the response has gone out, so work deferred past the response may stall until the next request
 * happens to arrive. A ~300 ms POST inline is the cheaper trade. `sendEmail` never throws and caps
 * itself at 8 s, so a Resend outage can delay these callers but never fail them.
 */

import "server-only";
import { NOTIFY } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { INQUIRY_KIND_LABELS } from "@/lib/inquiry-status";
import type { Inquiry } from "@/lib/inquiries";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from "@/lib/payment-methods";
import type { Order } from "@/lib/orders";
import {
  C,
  FONT,
  LIVE_URL,
  MONO,
  chip,
  details,
  esc,
  escLines,
  formatWhen,
  link,
  panel,
  renderLayout,
  section,
} from "@/lib/email-layout";

function adminUrl(path: string): string {
  return `${LIVE_URL}/admin/${path}`;
}

/** Product links are stored site-relative ("/brands/…"); an email needs them absolute. */
function absolute(href: string): string {
  return /^https?:\/\//.test(href) ? href : `${LIVE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inquiries
// ─────────────────────────────────────────────────────────────────────────────

export function renderInquiryEmail(inquiry: Inquiry): { subject: string; html: string; text: string } {
  const kind = INQUIRY_KIND_LABELS[inquiry.kind];
  const href = adminUrl(`inquiries/${inquiry.id}`);
  // The ref keeps every subject unique, so Gmail doesn't thread unrelated inquiries together.
  const subject = `New ${kind.toLowerCase()} from ${inquiry.name} · ${inquiry.ref}`;

  const html = renderLayout({
    title: subject,
    preheader: inquiry.message.slice(0, 140),
    chips: `${chip(kind)}&nbsp; <span style="font:400 13px ${MONO};color:${C.muted};">${esc(inquiry.ref)}</span>`,
    heading: inquiry.name,
    intro: inquiry.clinic || undefined,
    body: [
      section(
        "Contact",
        details([
          ["Email", link(`mailto:${inquiry.email}`, inquiry.email)],
          ["Phone", inquiry.phone ? link(`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`, inquiry.phone) : ""],
          ["Clinic", esc(inquiry.clinic)],
          ["Received", esc(formatWhen(inquiry.createdAt))],
        ]),
      ),
      inquiry.product
        ? section("Asking about", `<p style="margin:0;font:700 15px/1.5 ${FONT};">${link(absolute(inquiry.product.href), inquiry.product.name)}</p>`)
        : "",
      section("Message", panel(escLines(inquiry.message))),
    ].join(""),
    cta: { label: "Open inquiry in admin", href },
    footerNote: `Reply to this email to answer ${inquiry.name} directly at ${inquiry.email}.`,
  });

  const text = [
    `${kind} — ${inquiry.ref}`,
    "",
    `Name:     ${inquiry.name}`,
    `Email:    ${inquiry.email}`,
    inquiry.phone ? `Phone:    ${inquiry.phone}` : undefined,
    inquiry.clinic ? `Clinic:   ${inquiry.clinic}` : undefined,
    `Received: ${formatWhen(inquiry.createdAt)}`,
    inquiry.product
      ? `Product:  ${inquiry.product.name} — ${absolute(inquiry.product.href)}`
      : undefined,
    "",
    "Message:",
    inquiry.message,
    "",
    `Open in admin: ${href}`,
    "",
    `Reply to this email to answer ${inquiry.name} directly.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { subject, html, text };
}

/** Tell sales about a new inquiry. Never throws. */
export async function notifyNewInquiry(inquiry: Inquiry): Promise<boolean> {
  const { subject, html, text } = renderInquiryEmail(inquiry);
  return sendEmail({
    to: [...NOTIFY.inquiries],
    subject,
    html,
    text,
    replyTo: inquiry.email,
    idempotencyKey: `inquiry/${inquiry.id}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

/** PayMongo's method code as the team would say it. `manual` is the admin's offline mark-paid. */
function methodLabel(method: string): string {
  if (method === "manual") return "Recorded offline by staff";
  return PAYMENT_METHOD_LABELS[method as PaymentMethodType] ?? (method || "—");
}

function addressLines(order: Order): string[] {
  const s = order.shipping;
  return [
    [s.address, s.apartment].filter(Boolean).join(", "),
    [s.barangay, s.city].filter(Boolean).join(", "),
    [s.region, s.postal].filter(Boolean).join(" "),
    s.country,
  ].filter(Boolean);
}

function itemsTable(order: Order): string {
  const th = `padding:0 0 8px;font:700 11px/1.2 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.line};`;
  const td = `padding:12px 0;border-bottom:1px solid ${C.line};font:400 14px/1.4 ${FONT};color:${C.fg};`;

  const rows = order.lines
    .map(
      (l) => `
  <tr>
    <td style="${td}padding-right:12px;">
      <div style="font-weight:700;">${esc(l.name)}</div>
      ${l.sku ? `<div style="margin-top:2px;font:400 12px ${MONO};color:${C.muted};">SKU ${esc(l.sku)}</div>` : ""}
    </td>
    <td align="center" style="${td}white-space:nowrap;padding-right:12px;">${l.quantity}${l.unit ? ` ${esc(l.unit)}` : ""}</td>
    <td align="right" style="${td}white-space:nowrap;padding-right:12px;color:${C.muted};">${esc(formatPHP(l.price))}</td>
    <td align="right" style="${td}white-space:nowrap;font-weight:700;">${esc(formatPHP(l.lineTotal))}</td>
  </tr>`,
    )
    .join("");

  const total = (label: string, value: string, strong = false) => `
  <tr>
    <td colspan="3" align="right" style="padding:${strong ? "10px" : "4px"} 12px 0 0;font:${strong ? 700 : 400} ${strong ? 15 : 14}px/1.4 ${FONT};color:${strong ? C.fg : C.muted};">${esc(label)}</td>
    <td align="right" style="padding:${strong ? "10px" : "4px"} 0 0;white-space:nowrap;font:${strong ? 700 : 400} ${strong ? 15 : 14}px/1.4 ${FONT};color:${C.fg};">${esc(value)}</td>
  </tr>`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="${th}">Item</td>
    <td align="center" style="${th}padding-right:12px;">Qty</td>
    <td align="right" style="${th}padding-right:12px;">Unit</td>
    <td align="right" style="${th}">Amount</td>
  </tr>
  ${rows}
  <tr><td colspan="4" style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
  ${total("Subtotal", formatPHP(order.subtotal))}
  ${total("Shipping", order.shippingFee ? formatPHP(order.shippingFee) : "Free")}
  ${total("Total", formatPHP(order.total), true)}
</table>`;
}

export function renderOrderEmail(order: Order): { subject: string; html: string; text: string } {
  const name = `${order.customer.firstName} ${order.customer.lastName}`.trim();
  const paid = order.paymentStatus === "paid";
  const href = adminUrl(`orders/${order.id}`);
  const items = plural(order.itemCount, "item");
  const subject = paid
    ? `Paid order ${order.ref} · ${formatPHP(order.total)} · ${items}`
    : `New order ${order.ref} · ${formatPHP(order.total)} · payment to arrange`;

  // A payment can still land on an order staff already cancelled (a stale PayMongo tab). It is
  // money in, so it is still reported — but nobody should pack it without checking first.
  const cancelled = order.status === "cancelled";

  const chips = [
    paid ? chip("Paid", "success") : chip("Payment to arrange", "brand"),
    cancelled ? chip(ORDER_STATUS_LABELS.cancelled, "danger") : "",
    `<span style="font:400 13px ${MONO};color:${C.muted};">${esc(order.ref)}</span>`,
  ]
    .filter(Boolean)
    .join("&nbsp; ");

  const shipTo = `
<div style="font:700 14px/1.5 ${FONT};color:${C.fg};">${esc(name)}</div>
<div style="font:400 14px/1.6 ${FONT};color:${C.fg};">${addressLines(order).map(esc).join("<br>")}</div>`;

  const customer = details([
    ["Email", link(`mailto:${order.customer.email}`, order.customer.email)],
    ["Phone", link(`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`, order.customer.phone)],
    ["Account", order.customer.userId ? "Signed-in customer" : "Guest checkout"],
  ]);

  const html = renderLayout({
    title: subject,
    preheader: `${name} · ${items} · ${formatPHP(order.total)}${paid ? ` paid via ${methodLabel(order.paymentMethod)}` : ""}`,
    chips,
    heading: `${formatPHP(order.total)} from ${name}`,
    intro: `${items} · placed ${formatWhen(order.createdAt)}`,
    body: [
      cancelled
        ? `<div style="margin-top:24px;">${panel(
            "<strong>This order was cancelled before the payment arrived.</strong> Check with the team before packing it — it may need a refund instead.",
            "danger",
          )}</div>`
        : "",
      section("Items", itemsTable(order)),
      section(
        "Payment",
        details([
          ["Status", paid ? "Paid" : "Awaiting payment — the team arranges it with the customer"],
          ["Method", paid ? esc(methodLabel(order.paymentMethod)) : ""],
          ["Paid at", paid ? esc(formatWhen(order.paidAt)) : ""],
        ]),
      ),
      // Two columns on desktop; `.stack` folds them into one on a phone, in clients that keep <style>.
      `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td class="stack" valign="top" width="50%" style="padding-right:12px;">${section("Ship to", shipTo)}</td>
    <td class="stack" valign="top" width="50%" style="padding-left:12px;">${section("Customer", customer)}</td>
  </tr>
</table>`,
    ].join(""),
    cta: { label: "Open order in admin", href },
    footerNote: "Sent automatically when an order is paid on rrnewtechdental.com.",
  });

  const text = [
    `${paid ? "PAID ORDER" : "NEW ORDER — payment to arrange"} ${order.ref}`,
    cancelled ? "\n!! This order was cancelled before the payment arrived — check before packing.\n" : "",
    `${name} · ${items} · ${formatPHP(order.total)}`,
    `Placed: ${formatWhen(order.createdAt)}`,
    paid ? `Paid:   ${formatWhen(order.paidAt)} via ${methodLabel(order.paymentMethod)}` : "",
    "",
    "Items:",
    ...order.lines.map(
      (l) =>
        `  ${l.quantity} × ${l.name}${l.sku ? ` [${l.sku}]` : ""} — ${formatPHP(l.lineTotal)}`,
    ),
    "",
    `Subtotal: ${formatPHP(order.subtotal)}`,
    `Shipping: ${order.shippingFee ? formatPHP(order.shippingFee) : "Free"}`,
    `Total:    ${formatPHP(order.total)}`,
    "",
    "Ship to:",
    `  ${name}`,
    ...addressLines(order).map((line) => `  ${line}`),
    "",
    `Customer: ${order.customer.email} · ${order.customer.phone}`,
    "",
    `Open in admin: ${href}`,
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

  return { subject, html, text };
}

/** Tell inventory about an order that needs fulfilling. Never throws. */
export async function notifyOrder(order: Order): Promise<boolean> {
  const { subject, html, text } = renderOrderEmail(order);
  return sendEmail({
    to: [...NOTIFY.orders],
    subject,
    html,
    text,
    // Keyed on what triggered it, so the gateway-off "placed" email and a later "paid" one (should
    // staff then mark it paid) are distinct sends rather than the second being swallowed.
    idempotencyKey: `order/${order.id}/${order.paymentStatus}`,
  });
}
