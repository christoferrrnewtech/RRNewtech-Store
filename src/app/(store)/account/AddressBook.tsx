"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/checkout/SearchableSelect";
import { useLocations } from "@/components/checkout/useLocations";
import { FormMessage, SubmitButton } from "@/components/ui/FormControls";
import { listBarangaysAction, listCitiesAction } from "@/app/(store)/actions";
import {
  deleteAddressAction,
  importAddressesAction,
  saveAddressAction,
  setDefaultAddressAction,
} from "@/app/(store)/account/address-actions";
import { ADDRESS_LABELS, ADDRESS_LABEL_NAMES, type CustomerAddress } from "@/lib/address-book";
import { addressLines } from "@/lib/addresses";
import { formatPhone } from "@/lib/customer-fields";
import type { ActionState } from "@/lib/form-data";

/**
 * The address book on /account: the saved addresses, and the form for adding or editing one.
 *
 * A client component because the editor is a mode, not a page — opening it must not lose the rest
 * of the dashboard, and the province → city → barangay cascade needs the same interactive
 * behaviour it has at checkout (and uses the same hook and Server Actions to get it).
 *
 * Every mutation goes through a Server Action that re-derives the customer from the session
 * cookie; nothing here is trusted to say whose book it is. The list itself is rendered from props
 * the page fetched, and each action calls `revalidatePath("/account")`, so the page re-renders
 * with the new list rather than this component keeping a second copy of the truth in state.
 */

const field =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-fg outline-none " +
  "placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/** The recipient details a NEW address starts from — the account holder's own. */
export type AddressDefaults = {
  firstName: string;
  lastName: string;
  phone: string;
};

export function AddressBook({
  addresses,
  provinces,
  defaults,
  importable,
}: {
  addresses: CustomerAddress[];
  /** Philippine provinces, rendered in by the server — same list checkout gets. */
  provinces: string[];
  defaults: AddressDefaults;
  /**
   * How many distinct addresses appear in past orders but not yet in the book. Non-zero only for
   * customers who ordered before the book existed, and the only thing that puts the import button
   * on screen — nobody else should be offered a button that would do nothing.
   */
  importable: number;
}) {
  // `null` = closed, `""` = adding, an id = editing that address.
  const [editing, setEditing] = useState<string | null>(null);
  // Stable identity: the editor's close effect depends on it, and a fresh closure each render
  // would re-run that effect on every keystroke in the form.
  const close = useCallback(() => setEditing(null), []);

  const [saveState, save] = useActionState<ActionState, FormData>(saveAddressAction, {});
  const [rowState, rowAction] = useActionState<ActionState, FormData>(rowDispatch, {});
  const [importState, importAddresses] = useActionState<ActionState, FormData>(
    importAddressesAction,
    {},
  );

  const target = editing ? addresses.find((a) => a.id === editing) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* One banner for the row actions (default / remove) — they can't run at the same time, so a
          per-card message would be three places to look for one answer. */}
      <FormMessage state={rowState} />
      <FormMessage state={importState} />

      {addresses.length === 0 && editing === null && (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          No saved addresses yet. Add one here, or check out once and we&apos;ll remember it for you.
        </div>
      )}

      {addresses.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs font-semibold text-muted">
                  {ADDRESS_LABEL_NAMES[address.label]}
                </span>
                {address.isDefault && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    Default
                  </span>
                )}
              </div>

              <p className="mt-2.5 text-sm font-semibold text-fg">
                {`${address.firstName} ${address.lastName}`.trim()}
              </p>
              <address className="mt-0.5 text-sm not-italic leading-relaxed text-muted">
                {addressLines(address.shipping).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                {address.phone && <span className="block">{formatPhone(address.phone)}</span>}
              </address>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setEditing(address.id)}
                  className="text-brand-700 hover:text-brand-800"
                >
                  Edit
                </button>

                {!address.isDefault && (
                  <form action={rowAction}>
                    <input type="hidden" name="intent" value="default" />
                    <input type="hidden" name="id" value={address.id} />
                    <RowButton>Make default</RowButton>
                  </form>
                )}

                <form action={rowAction} className="ml-auto">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={address.id} />
                  <RowButton danger>Remove</RowButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <AddressForm
          // Remounts the whole form when the customer switches between cards, so every
          // `defaultValue` below is re-read. Without it, clicking Edit on a second address would
          // keep the first one's values in the uncontrolled inputs.
          key={target?.id ?? "new"}
          address={target}
          provinces={provinces}
          defaults={defaults}
          state={saveState}
          action={save}
          onClose={close}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing("")}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            Add an address
          </button>

          {importable > 0 && (
            <form action={importAddresses}>
              <ImportButton count={importable} />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One `useActionState` for both row buttons.
 *
 * `useActionState` can't be called inside the list — hooks can't live in a loop — and giving each
 * card its own would mean one hook per address anyway. So the row forms post an `intent` and this
 * fans out to the real action, which keeps a single result banner for the whole list.
 */
async function rowDispatch(prev: ActionState, form: FormData): Promise<ActionState> {
  return form.get("intent") === "delete"
    ? deleteAddressAction(prev, form)
    : setDefaultAddressAction(prev, form);
}

function RowButton({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="submit"
      className={`text-sm font-semibold ${
        danger ? "text-muted hover:text-danger" : "text-brand-700 hover:text-brand-800"
      }`}
    >
      {children}
    </button>
  );
}

function ImportButton({ count }: { count: number }) {
  return (
    <button
      type="submit"
      className="rounded-lg border border-dashed border-line bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-elevated hover:text-fg"
    >
      Import {count} from past orders
    </button>
  );
}

/**
 * Add or edit one address.
 *
 * Uncontrolled inputs with `defaultValue`, exactly like checkout — the Server Action reads
 * FormData, so mirroring every field into state would buy nothing. The three location fields are
 * the exception, for the same reason as there: each decides what the next can offer.
 */
function AddressForm({
  address,
  provinces,
  defaults,
  state,
  action,
  onClose,
}: {
  address?: CustomerAddress;
  provinces: string[];
  defaults: AddressDefaults;
  state: ActionState;
  action: (form: FormData) => void;
  onClose: () => void;
}) {
  /**
   * Close once THIS editor's save succeeds.
   *
   * `state.ok` alone is not enough: `useActionState` keeps the last result for the life of the
   * page, so a form opened after an earlier successful save would see a stale "ok" and shut itself
   * the instant it appeared. Comparing against the result that was current at mount is what
   * distinguishes "already true" from "just became true" — and the editor remounts whenever it
   * opens, so the snapshot is always the right one.
   */
  const [openedWith] = useState(state);
  const justSaved = state !== openedWith && Boolean(state.ok);

  useEffect(() => {
    // The list behind this form has already been re-rendered from the server by the action's
    // revalidatePath, so closing hands the customer straight back to the saved card.
    if (justSaved) onClose();
  }, [justSaved, onClose]);

  const [region, setRegion] = useState(address?.shipping.region ?? "");
  const [city, setCity] = useState(address?.shipping.city ?? "");
  const [barangay, setBarangay] = useState(address?.shipping.barangay ?? "");

  const loadCities = useCallback(() => listCitiesAction(region), [region]);
  const loadBarangays = useCallback(() => listBarangaysAction(region, city), [region, city]);

  const provinceOptions = useMemo(
    () => provinces.map((name) => ({ value: name, label: name })),
    [provinces],
  );
  const cities = useLocations(region ? `cities:${region}` : "", loadCities);
  const barangays = useLocations(region && city ? `brgy:${region}:${city}` : "", loadBarangays);

  // Changing a level invalidates everything under it — without this, switching the province after
  // picking a city would save "Cebu City, Davao": well-formed, and undeliverable.
  function setProvince(next: string) {
    setRegion(next);
    setCity("");
    setBarangay("");
  }
  function setCityValue(next: string) {
    setCity(next);
    setBarangay("");
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      {address && <input type="hidden" name="id" value={address.id} />}

      <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-fg">
        {address ? "Edit address" : "Add an address"}
      </h3>

      <div className="mt-4 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="First name">
            <input
              required
              name="firstName"
              className={field}
              defaultValue={address?.firstName ?? defaults.firstName}
            />
          </Labelled>
          <Labelled label="Last name">
            <input
              required
              name="lastName"
              className={field}
              defaultValue={address?.lastName ?? defaults.lastName}
            />
          </Labelled>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Phone">
            <input
              required
              name="phone"
              inputMode="tel"
              className={field}
              placeholder="09xx xxx xxxx"
              defaultValue={formatPhone(address?.phone ?? defaults.phone)}
            />
          </Labelled>
          <Labelled label="Label">
            <select
              name="label"
              className={field}
              defaultValue={address?.label ?? "home"}
            >
              {ADDRESS_LABELS.map((value) => (
                <option key={value} value={value}>
                  {ADDRESS_LABEL_NAMES[value]}
                </option>
              ))}
            </select>
          </Labelled>
        </div>

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
          <Labelled label="Postal code">
            <input
              required
              name="postal"
              inputMode="numeric"
              className={field}
              defaultValue={address?.shipping.postal ?? ""}
            />
          </Labelled>
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
          <Labelled label={<>Apartment <span className="font-normal text-muted-light">(optional)</span></>}>
            <input
              name="apartment"
              className={field}
              placeholder="Unit, floor, building"
              defaultValue={address?.shipping.apartment ?? ""}
            />
          </Labelled>
        </div>

        <Labelled label="Address line">
          <input
            required
            name="address"
            className={field}
            placeholder="House / unit no. and street"
            defaultValue={address?.shipping.address ?? ""}
          />
        </Labelled>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
            // The first address is the default whatever this says (see saveCustomerAddress), so
            // offering to turn it off would be a lie. It is also already checked below.
            disabled={address?.isDefault}
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
          />
          Deliver here by default
        </label>

        <FormMessage state={state} />

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving…" size="sm">
            {address ? "Save changes" : "Save address"}
          </SubmitButton>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-muted hover:text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

/** Label above a control. The account form's own `Field` is for a different grid; this is simpler. */
function Labelled({
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
