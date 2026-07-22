"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart";
import { formatPHP } from "@/lib/format";
import { SITE } from "@/lib/constants";

/**
 * Phase 1 contact form. There is no backend yet, so on submit we compose a pre-filled email
 * (mailto:) to the sales inbox — the form still "works" end-to-end with zero server code.
 * Phase 2 swaps this for a POST to an API route (Resend + DB), mirroring DentPool's pattern.
 */
export function ContactForm() {
  const params = useSearchParams();
  const isCartInquiry = params.get("inquiry") === "cart";
  const { items, subtotal } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const cartSummary =
    isCartInquiry && items.length > 0
      ? "\n\nMy cart:\n" +
        items
          .map((i) => `• ${i.quantity} × ${i.name} (${i.sku}) — ${formatPHP(i.price * i.quantity)}`)
          .join("\n") +
        `\n\nSubtotal: ${formatPHP(subtotal)}`
      : "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = isCartInquiry
      ? `Order inquiry from ${name || "website"}`
      : `Website inquiry from ${name || "website"}`;
    const body =
      `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}${cartSummary}`.trim();
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted-light focus:border-brand-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isCartInquiry && (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-brand-700">
          Your cart ({items.length} item{items.length === 1 ? "" : "s"}) will be included with this
          message.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Juan dela Cruz" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="09xx xxx xxxx" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        Email
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@email.com" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-fg">
        Message
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className={field}
          placeholder={isCartInquiry ? "Any notes about your order, delivery address, etc." : "How can we help?"}
        />
      </label>
      <Button type="submit" size="lg" className="sm:self-start">
        {isCartInquiry ? "Send order inquiry" : "Send message"}
      </Button>
      <p className="text-xs text-muted-light">
        This opens your email app pre-filled to {SITE.email}. Secure online submission &amp;
        payment are coming soon.
      </p>
    </form>
  );
}
