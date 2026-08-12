"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A type-to-filter dropdown, built from scratch — no dependency, no `<select>`.
 *
 * WHY NOT A NATIVE SELECT: the lists this exists for are 82 provinces and ~1,600 municipalities.
 * A native picker makes the customer scroll all of that, which on a phone is the single worst
 * moment in a checkout. Typing "ceb" instead is the difference between an order and an abandoned
 * cart, and this is the first thing on the page now that shipping is rated from it.
 *
 * WHY NOT A COMBOBOX LIBRARY: the accessible behaviour needed here is small and well defined
 * (below), and this repo has no UI-primitive dependency to hang one off.
 *
 * ACCESSIBILITY — the ARIA combobox pattern, deliberately and not decoratively:
 *   - `role="combobox"` on the input with `aria-expanded` / `aria-controls` / `aria-activedescendant`
 *   - ↑ ↓ move the active option, Enter picks it, Escape closes, Tab commits and moves on
 *   - the active option is a real element id, so a screen reader announces it as it moves
 *   - blur reverts to the last valid selection: a half-typed "Ceb" must never post as an address
 *
 * The VALUE IS A NAME, not a code, because the name is what goes to JRS and onto the waybill.
 * A hidden input carries it, so the surrounding form still posts plain FormData and the server
 * action reads it exactly as it read the old free-text field.
 */

export type SelectOption = { value: string; label: string };

export function SearchableSelect({
  name,
  label,
  options,
  value,
  onChange,
  disabled,
  loading,
  placeholder,
  emptyLabel = "No matches",
  required,
}: {
  /** Posted field name. A hidden input carries the committed value. */
  name: string;
  label: React.ReactNode;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Options are still being fetched — the control stays visible but inert. */
  loading?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
}) {
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // While closed the input displays the SELECTION; while open it displays what's being typed.
  // Keeping those separate is what lets an abandoned search revert cleanly on blur.
  const display = open ? query : value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!open || !q || q === value.toLowerCase()) return options;
    // `includes`, not `startsWith`: "Cebu" should find "Cebu City" AND "Lapu-Lapu City, Cebu",
    // and someone typing "makati" shouldn't be punished for not knowing it's "City of Makati".
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, open, value]);

  // Close on an outside click. Pointerdown rather than click so it fires before focus moves.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the active option in view when it moves by keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({
      block: "nearest",
    });
    // optionId is derived from listId, which is stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  function commit(option: SelectOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        if (filtered.length === 0) return 0;
        return (i + step + filtered.length) % filtered.length;
      });
      return;
    }
    if (e.key === "Enter" && open) {
      // Only swallow Enter when there is something to pick — otherwise let it submit the form.
      const option = filtered[active];
      if (option) {
        e.preventDefault();
        commit(option);
      }
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setQuery("");
      setOpen(false);
    }
  }

  const isDisabled = disabled || loading;

  return (
    <label className="flex flex-col text-sm font-medium text-fg">
      <span>{label}</span>
      <span ref={rootRef} className="relative mt-auto pt-1">
        {/* What the form actually posts. The visible input is a search box, never a value. */}
        <input type="hidden" name={name} value={value} />

        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
          autoComplete="off"
          disabled={isDisabled}
          // `required` on the visible input so the browser's own validation bubble points at
          // something the customer can actually see and focus.
          required={required}
          value={loading ? "" : display}
          placeholder={loading ? "Loading…" : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            // Revert to the committed selection. A partial search string is not an address.
            setQuery("");
            setOpen(false);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-fg placeholder:text-muted-light focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted-light"
        />

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-light"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {open && !isDisabled && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-light">{emptyLabel}</li>
            ) : (
              filtered.map((option, i) => (
                <li
                  key={option.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={option.value === value}
                  // Mousedown, not click: click fires after blur, which would have closed the list
                  // and reverted the query before the selection ever landed.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    i === active ? "bg-brand-50 text-brand-800" : "text-fg"
                  } ${option.value === value ? "font-semibold" : ""}`}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        )}
      </span>
    </label>
  );
}
