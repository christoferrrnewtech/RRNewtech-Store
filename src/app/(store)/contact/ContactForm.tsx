"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SITE } from "@/lib/constants";

/**
 * Phase 1 contact form. There is no backend yet, so on submit we compose a pre-filled email
 * (mailto:) to the sales inbox — the form still "works" end-to-end with zero server code.
 * Phase 2 swaps this for a POST to an API route (Resend + DB). Cart/checkout has its own page
 * (/checkout); this form is purely "contact us".
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Website inquiry from ${name || "website"}`;
    const body = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`.trim();
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted-light focus:border-brand-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          placeholder="How can we help?"
        />
      </label>
      <Button type="submit" size="lg" className="sm:self-start">
        Send message
      </Button>
      <p className="text-xs text-muted-light">
        This opens your email app pre-filled to {SITE.email}. Secure online submission &amp; payment
        are coming soon.
      </p>
    </form>
  );
}
