"use client";

import { useEffect, useState } from "react";
import type { SelectOption } from "@/components/checkout/SearchableSelect";

/**
 * Fetch one level of the address cascade.
 *
 * Lifted out of CheckoutClient when the account page grew an address form: both screens ask for
 * the same province → city → barangay chain from the same Server Actions, and a second copy of
 * this would be a second place for the out-of-order bug below to come back.
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
 * already moved past — picking Cebu, then Davao before Cebu's cities land, must not repopulate the
 * list with Cebu's.
 */
export function useLocations(
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
