"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button, LinkButton } from "@/components/ui/Button";
import { useCart } from "@/lib/cart";
import { formatPHP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, SITE } from "@/lib/constants";

const field =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-fg placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const labelCls = "flex flex-col gap-1 text-sm font-medium text-fg";

/**
 * Phase 1 checkout — a bold, brand-forward split screen (compact shipping form on white, order
 * summary on a full-height brand-blue panel), but with no payment backend yet: "Place order"
 * composes a pre-filled order email (mailto) to the sales inbox. Phase 2 swaps the submit for a
 * POST + payment gateway.
 */
export function CheckoutClient() {
  const { items, subtotal } = useCart();
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");

  if (items.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
          Checkout
        </h1>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-muted">Your cart is empty — nothing to check out yet.</p>
          <LinkButton href="/" className="mt-5">
            Browse the shop
          </LinkButton>
        </div>
      </Container>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = `${firstName} ${lastName}`.trim();
    const orderLines = items
      .map(
        (i) =>
          `• ${i.quantity} × ${i.name}${i.sku ? ` (${i.sku})` : ""} — ${formatPHP(
            i.price * i.quantity,
          )}`,
      )
      .join("\n");
    const shipping = [
      address + (apartment ? `, ${apartment}` : ""),
      [barangay, city].filter(Boolean).join(", "),
      [region, postal].filter(Boolean).join(" "),
      "Philippines",
    ]
      .filter((line) => line.trim())
      .join("\n");
    const body =
      `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n` +
      `Shipping address:\n${shipping}\n\n` +
      `Order:\n${orderLines}\n\nSubtotal: ${formatPHP(subtotal)}`;
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
      `Order from ${name || "website"}`,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="lg:flex lg:flex-1 lg:items-stretch">
      {/* Order summary — bold brand panel, bleeds to the right edge; stacks on top on mobile */}
      <aside className="bg-gradient-to-br from-brand-700 to-brand-900 text-white lg:order-2 lg:w-[26rem] lg:shrink-0">
        <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 lg:mx-0 lg:px-10 lg:py-12 lg:sticky lg:top-24">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
            Order summary
          </h2>

          <ul className="mt-5 space-y-4">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                  <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-brand-700 shadow">
                    {item.quantity}
                  </span>
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</p>
                <span className="shrink-0 text-sm font-semibold">
                  {formatPHP(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-sm">
            <div className="flex justify-between">
              <span className="text-white/70">Subtotal</span>
              <span className="font-semibold">{formatPHP(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Shipping</span>
              <span className="text-white/70">
                {remaining > 0 ? "Calculated at checkout" : "Free"}
              </span>
            </div>
          </div>

          {remaining > 0 && (
            <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/90">
              Add {formatPHP(remaining)} more for free shipping.
            </p>
          )}

          <div className="mt-5 flex items-baseline justify-between border-t border-white/15 pt-5">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-extrabold">{formatPHP(subtotal)}</span>
          </div>
        </div>
      </aside>

      {/* Contact + shipping form — white, hugs the centre seam on desktop */}
      <div className="bg-surface lg:order-1 lg:min-w-0 lg:flex-1">
        <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:ml-auto lg:px-10 lg:py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
              Checkout
            </h1>
            <Link href="/cart" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              ← Back to cart
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">Contact</h2>
              <label className={`mt-3 ${labelCls}`}>
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                  placeholder="you@email.com"
                />
              </label>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">
                Shipping address
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    First name
                    <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} placeholder="Juan" />
                  </label>
                  <label className={labelCls}>
                    Last name
                    <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} placeholder="dela Cruz" />
                  </label>
                </div>
                <label className={labelCls}>
                  Address
                  <input required value={address} onChange={(e) => setAddress(e.target.value)} className={field} placeholder="House / unit no. and street" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    Apartment, suite, etc. <span className="font-normal text-muted-light">(optional)</span>
                    <input value={apartment} onChange={(e) => setApartment(e.target.value)} className={field} />
                  </label>
                  <label className={labelCls}>
                    Barangay
                    <input required value={barangay} onChange={(e) => setBarangay(e.target.value)} className={field} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={labelCls}>
                    City / Municipality
                    <input required value={city} onChange={(e) => setCity(e.target.value)} className={field} />
                  </label>
                  <label className={labelCls}>
                    Region / Province
                    <input required value={region} onChange={(e) => setRegion(e.target.value)} className={field} />
                  </label>
                  <label className={labelCls}>
                    Postal code
                    <input required value={postal} onChange={(e) => setPostal(e.target.value)} className={field} inputMode="numeric" />
                  </label>
                </div>
                <label className={labelCls}>
                  Phone
                  <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="09xx xxx xxxx" inputMode="tel" />
                </label>
              </div>
            </section>

            <div>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Place order
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-light">
                Online payment (GCash, Maya, card) via a secure Philippine gateway is coming soon.
                For now, placing your order opens your email pre-filled to {SITE.email}, and our team
                confirms stock, shipping, and payment.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
