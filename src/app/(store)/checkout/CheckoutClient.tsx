"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { FormMessage, Honeypot, SubmitButton } from "@/components/ui/FormControls";
import { useCart } from "@/lib/cart";
import { formatPHP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { PAYMENT_METHODS_SENTENCE } from "@/lib/payment-methods";
import { PendingPaymentNotice } from "@/components/checkout/PendingPaymentNotice";
import { SearchableSelect, type SelectOption } from "@/components/checkout/SearchableSelect";
import {
  listBarangaysAction,
  listCitiesAction,
  placeOrderAction,
  quoteShippingAction,
  type ShippingQuote,
} from "@/app/(store)/actions";
import type { ActionState } from "@/lib/form-data";

/**
 * How long the customer must stop typing before we spend a courier call.
 *
 * Long enough that typing "Quezon City" costs one request rather than eleven, short enough that
 * tabbing to the next field feels like it already knew.
 */
const QUOTE_DEBOUNCE_MS = 700;

type QuoteState =
  /** Not enough address yet to ask. */
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; quote: ShippingQuote };

const field =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-fg placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/**
 * One labelled control. The label text and the control live in separate spans so a label that
 * wraps to two lines can't push its input below its neighbour's: the grid stretches every cell to
 * the tallest in the row, and `mt-auto` parks the control on the cell's bottom edge. Spans rather
 * than divs — <label> only accepts phrasing content.
 */
function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col text-sm font-medium text-fg">
      <span>{label}</span>
      <span className="mt-auto pt-1">{children}</span>
    </label>
  );
}

/**
 * Fetch one level of the address cascade.
 *
 * `key` identifies WHAT is wanted ("" means nothing yet, which is what makes this a cascade: no
 * province, no city list). Everything the caller renders is derived from comparing it against the
 * key the held options came back under:
 *
 *   key === ""            → disabled, no options
 *   loaded.key === key    → these are the right options
 *   otherwise             → loading
 *
 * That comparison is doing two jobs. It gives `loading` without storing it, so nothing sets state
 * synchronously inside the effect. And it discards a slow reply for a level the customer has
 * already moved past — the same out-of-order hazard as the shipping quote, fixed the same way.
 */
function useLocations(
  key: string,
  load: () => Promise<SelectOption[]>,
): { options: SelectOption[]; loading: boolean } {
  const [loaded, setLoaded] = useState<{ key: string; options: SelectOption[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load().then(
      (options) => {
        if (!cancelled) setLoaded({ key, options });
      },
      // A failed lookup settles as an empty list rather than staying "loading" forever. The action
      // already logged why; the customer sees an empty dropdown, which is at least honest.
      () => {
        if (!cancelled) setLoaded({ key, options: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, load]);

  if (!key) return { options: [], loading: false };
  if (loaded?.key === key) return { options: loaded.options, loading: false };
  return { options: [], loading: true };
}

/**
 * The Shipping row's right-hand side.
 *
 * Four states, and every one of them says something true. The temptation is to render "—" or a
 * stale figure while waiting, but a checkout that quietly shows the wrong delivery cost is exactly
 * the support ticket the flat rate used to create.
 *
 * Note that nothing here promises to sort shipping out later. If the rate can't be had, placing the
 * order fails with the same message — the customer never gets to PayMongo without knowing the total.
 */
function ShippingAmount({ state }: { state: QuoteState }) {
  if (state.kind === "idle") {
    return (
      <span className="text-right text-xs text-white/60">
        Enter your city and province to see shipping
      </span>
    );
  }
  if (state.kind === "loading") {
    return <span className="text-right text-xs text-white/60">Calculating…</span>;
  }
  if (state.quote.status === "quoted") {
    return state.quote.shippingFee === 0 ? (
      <span className="text-white/70">Free</span>
    ) : (
      <span className="font-semibold">{formatPHP(state.quote.shippingFee)}</span>
    );
  }
  // amber-200 rather than the `warn` token: that one is tuned for white admin surfaces and
  // disappears against this brand-blue panel.
  return (
    <span className="text-right text-xs text-amber-200">
      Couldn&apos;t rate this address — check it and try again
    </span>
  );
}

/**
 * Checkout — a bold, brand-forward split screen (compact shipping form on white, order summary on a
 * full-height brand-blue panel). Submitting records the order in Firestore via `placeOrderAction`
 * as `awaiting_payment` and sends the customer to `/checkout/pay`, which is where the hand-off to
 * PayMongo happens. With PayMongo unconfigured it keeps the older behaviour: record the order,
 * team arranges payment.
 *
 * The totals here are DISPLAY ONLY and come from a localStorage cart that can be weeks stale — the
 * server reprices everything and re-quotes shipping before charging a peso.
 *
 * The inputs are uncontrolled: the server action reads the FormData, so mirroring every field into
 * React state would buy nothing. `lines` posts the cart for the server to REPRICE — the prices in
 * that payload are never used, since a cart in localStorage can be stale or hand-edited.
 *
 * The two exceptions are city and province, which ARE mirrored — not to post them, but because a
 * real JRS rate needs a destination, and the summary can't ask for one until the customer has typed
 * it. `quoteShippingAction` runs server-side (the courier key can never reach a browser) behind a
 * debounce, and its answer is advisory: `placeOrderAction` quotes again from the submitted form and
 * that is what's charged.
 */
/** The resume notice's data, resolved server-side in `page.tsx`. */
export type PendingCheckout = {
  ref: string;
  total: number;
  expiresAt: number;
  retry: boolean;
};

export function CheckoutClient({
  paymentsEnabled,
  cancelled,
  pending,
  provinces,
}: {
  paymentsEnabled: boolean;
  cancelled: boolean;
  pending: PendingCheckout | null;
  /** JRS's serviceable provinces, rendered in by the server — see checkout/page.tsx. */
  provinces: string[];
}) {
  const { items, subtotal } = useCart();
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const [state, action] = useActionState<ActionState, FormData>(placeOrderAction, {});

  // Only what identifies a line. Names and prices are re-read from the catalog server-side; `href`
  // is how a brand line's brand is recovered, since a cart line stores the product id but not it.
  const linesPayload = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({ source: i.source, id: i.id, quantity: i.quantity, href: i.href })),
      ),
    [items],
  );

  // The three cascading location fields. Controlled, unlike the rest of the form, because each one
  // decides what the next can offer — and because the rate is quoted from two of them.
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");
  const [result, setResult] = useState<{ key: string; quote: ShippingQuote } | null>(null);

  // useCallback so each loader's identity changes only when what it fetches changes — the hook's
  // effect depends on it, and a fresh closure every render would re-fetch on every keystroke.
  const loadCities = useCallback(() => listCitiesAction(region), [region]);
  const loadBarangays = useCallback(() => listBarangaysAction(region, city), [region, city]);

  const provinceOptions = useMemo(
    () => provinces.map((name) => ({ value: name, label: name })),
    [provinces],
  );
  const cities = useLocations(region ? `cities:${region}` : "", loadCities);
  const barangays = useLocations(region && city ? `brgy:${region}:${city}` : "", loadBarangays);

  // Changing a level invalidates everything under it. Without this, picking Cebu → Cebu City and
  // then switching the province to Davao would post "Cebu City, Davao" — an address that rates
  // (JRS would price *something*) and cannot be delivered.
  function setProvince(next: string) {
    setRegion(next);
    setCity("");
    setBarangay("");
  }
  function setCityValue(next: string) {
    setCity(next);
    setBarangay("");
  }

  const to = city.trim();
  const province = region.trim();
  // Identifies exactly what a quote is FOR. Everything the row shows is derived from comparing it
  // against the key the stored answer came back under, which means "idle" and "loading" need no
  // state of their own — and a reply for an address the customer has already edited past can never
  // be mistaken for a current one.
  const quoteKey =
    to && province && items.length > 0 ? JSON.stringify([to, province, linesPayload]) : "";

  useEffect(() => {
    if (!quoteKey) return;

    // Belt and braces alongside the key check: a reply that arrives after this effect is torn down
    // shouldn't set state on the way out either.
    let cancelled = false;

    const timer = setTimeout(() => {
      quoteShippingAction({ lines: linesPayload, city: to, region: province })
        .then((quote) => {
          if (!cancelled) setResult({ key: quoteKey, quote });
        })
        .catch(() => {
          if (!cancelled) setResult({ key: quoteKey, quote: { status: "error" } });
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteKey, linesPayload, to, province]);

  const quoteState: QuoteState = !quoteKey
    ? { kind: "idle" }
    : result?.key === quoteKey
      ? { kind: "done", quote: result.quote }
      : { kind: "loading" };

  const quoted =
    quoteState.kind === "done" && quoteState.quote.status === "quoted" ? quoteState.quote : null;
  // Only a real quote moves the total. Every other state is honest about not knowing yet, and
  // showing a total that silently excludes delivery would be the same lie the flat rate was.
  const total = subtotal + (quoted?.shippingFee ?? 0);

  const notice = pending ? (
    <PendingPaymentNotice
      orderRef={pending.ref}
      expiresAt={pending.expiresAt}
      total={pending.total}
      retry={pending.retry}
    />
  ) : null;

  if (items.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
          Checkout
        </h1>
        {/* Shown even with an empty cart: someone who cleared it still needs a route back to a
            payment they already owe. */}
        {notice && <div className="mt-6">{notice}</div>}
        <div className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-muted">Your cart is empty — nothing to check out yet.</p>
          <LinkButton href="/" className="mt-5">
            Browse the shop
          </LinkButton>
        </div>
      </Container>
    );
  }

  return (
    // -mb-20 cancels SiteFooter's mt-20 so this full-bleed page runs straight into the footer
    // instead of showing a band of page background below the brand panel.
    <div className="-mb-20 lg:flex lg:flex-1 lg:items-stretch">
      {/* Order summary — bold brand panel, bleeds to the right edge; stacks on top on mobile */}
      <aside className="bg-gradient-to-br from-brand-700 to-brand-900 text-white lg:order-2 lg:w-[26rem] lg:shrink-0">
        <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 lg:mx-0 lg:px-10 lg:py-8 lg:sticky lg:top-24">
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
            <div className="flex justify-between gap-4">
              <span className="text-white/70">Shipping</span>
              <ShippingAmount state={quoteState} />
            </div>
          </div>

          {quoted?.packagingName && quoted.shippingFee > 0 && (
            <p className="mt-3 text-xs text-white/60">
              Rated by JRS Express as a {quoted.packagingName}.
            </p>
          )}

          {remaining > 0 && (
            <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/90">
              Add {formatPHP(remaining)} more for free shipping.
            </p>
          )}

          <div className="mt-5 flex items-baseline justify-between border-t border-white/15 pt-5">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-extrabold">{formatPHP(total)}</span>
          </div>
        </div>
      </aside>

      {/* Contact + shipping form — white, hugs the centre seam on desktop */}
      <div className="bg-surface lg:order-1 lg:min-w-0 lg:flex-1">
        <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:ml-auto lg:px-10 lg:py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
              Checkout
            </h1>
            <Link href="/cart" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              ← Back to cart
            </Link>
          </div>

          {notice && <div className="mt-5">{notice}</div>}

          {cancelled && (
            <p
              role="status"
              className="mt-5 rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger"
            >
              Payment wasn&apos;t completed — nothing was charged. Your cart is still here, so you
              can try again below.
            </p>
          )}

          <form action={action} className="mt-6 flex flex-col gap-5">
            <input type="hidden" name="lines" value={linesPayload} />
            <Honeypot />

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">Contact</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <input required type="email" name="email" className={field} placeholder="you@email.com" />
                </Field>
                <Field label="Phone">
                  <input required name="phone" className={field} placeholder="09xx xxx xxxx" inputMode="tel" />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">
                Shipping address
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name">
                    <input required name="firstName" className={field} placeholder="Juan" />
                  </Field>
                  <Field label="Last name">
                    <input required name="lastName" className={field} placeholder="dela Cruz" />
                  </Field>
                </div>
                {/* Broadest first, narrowing down to the street. Province and city lead because
                    they are the ONLY two fields JRS rates on — putting them at the top means the
                    shipping figure resolves before the customer types anything else, instead of
                    appearing after they've finished and are looking at the button.

                    The three location fields are dropdowns fed by JRS's own serviceable-area
                    lists, so a picked address is by construction one JRS can rate. Each cascades:
                    choosing a province loads its cities, choosing a city loads its barangays. */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <SearchableSelect
                    required
                    name="region"
                    label="Region / Province"
                    options={provinceOptions}
                    value={region}
                    onChange={setProvince}
                    placeholder="Search…"
                  />
                  <SearchableSelect
                    required
                    name="city"
                    label="City / Municipality"
                    options={cities.options}
                    loading={cities.loading}
                    disabled={!region}
                    value={city}
                    onChange={setCityValue}
                    placeholder={region ? "Search…" : "Pick a province first"}
                  />
                  <Field label="Postal code">
                    <input required name="postal" className={field} inputMode="numeric" />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SearchableSelect
                    required
                    name="barangay"
                    label="Barangay"
                    options={barangays.options}
                    loading={barangays.loading}
                    disabled={!city}
                    value={barangay}
                    onChange={setBarangay}
                    placeholder={city ? "Search…" : "Pick a city first"}
                  />
                  <Field
                    label={
                      <>
                        Apartment <span className="font-normal text-muted-light">(optional)</span>
                      </>
                    }
                  >
                    <input name="apartment" className={field} placeholder="Unit, floor, building" />
                  </Field>
                </div>
                <Field label="Address line">
                  <input
                    required
                    name="address"
                    className={field}
                    placeholder="House / unit no. and street"
                  />
                </Field>
              </div>
            </section>

            <div>
              <FormMessage state={state} />
              {/* No amount on the button: the figure above comes from a cart that may be weeks
                  stale, and a button reading "Pay ₱3,150" beside a gateway charging ₱3,400 costs
                  far more trust than a generic label costs conversion. */}
              {/* "Review and pay", not "Continue to payment" — that label now belongs to the
                  button on /checkout/pay, and two buttons meaning different things would be a
                  small cruelty. This one only places the order. */}
              <SubmitButton
                pendingLabel={paymentsEnabled ? "Placing your order…" : "Placing order…"}
                className={`w-full sm:w-auto ${state.error ? "mt-3" : ""}`}
              >
                {paymentsEnabled ? "Review and pay" : "Place order"}
              </SubmitButton>
              <p className="mt-3 text-xs leading-relaxed text-muted-light">
                {paymentsEnabled ? (
                  <>
                    We&apos;ll show you a summary, then take you to PayMongo to pay securely with{" "}
                    {PAYMENT_METHODS_SENTENCE}. Prices, stock and shipping are re-checked before
                    payment. Delivery is rated by JRS Express from your address, and is free on
                    orders over {formatPHP(FREE_SHIPPING_THRESHOLD)}.
                  </>
                ) : (
                  <>
                    Online payment is being finalised. For now we record your order and our team
                    confirms stock, shipping, and payment before anything is charged.
                  </>
                )}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
