"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ACCOUNT_TABS, type AccountTab } from "./account-tabs";

/**
 * The /account frame: a profile card and tab nav on the left, one panel at a time on the right.
 *
 * Every panel is rendered by the server and handed in as a prop; this component only decides which
 * one is visible. Hidden panels stay MOUNTED (the `hidden` attribute, not conditional rendering),
 * so an address half-typed in the editor survives a look at the Orders tab.
 *
 * The active tab is mirrored to `?tab=` with `replaceState` — a link or a reload lands on the same
 * panel, but flicking between tabs doesn't fill the back button with entries, and it costs no
 * server round trip (Next keeps its router in step with a manual `replaceState`).
 */

const TabContext = createContext<(tab: AccountTab) => void>(() => {});

export type TabSpec = {
  id: AccountTab;
  label: string;
  /** Shown beside the label; omitted when the panel's query failed. */
  count?: number;
  /** Draws a dot on the tab — something in it is waiting on the customer. */
  attention?: boolean;
};

export function AccountDashboard({
  tabs,
  panels,
  initial,
  profile,
  signOut,
}: {
  tabs: TabSpec[];
  panels: Record<AccountTab, React.ReactNode>;
  initial: AccountTab;
  profile: React.ReactNode;
  signOut: React.ReactNode;
}) {
  const [active, setActive] = useState<AccountTab>(initial);
  const navRef = useRef<HTMLElement>(null);

  // On a phone the tabs are a sideways-scrolling strip, and a tab opened from a link (or the last
  // one, picked after scrolling) can sit half off the edge. Bring it fully into view. Done by hand
  // rather than `scrollIntoView`, which would also scroll the page vertically.
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) return;
    const left = tab.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft) nav.scrollLeft = left - 8;
    else if (left + tab.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = left + tab.offsetWidth - nav.clientWidth + 8;
    }
  }, [active]);

  const select = useCallback((tab: AccountTab) => {
    setActive(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    // A tab picked from far down a long list would otherwise open mid-page.
    if (window.scrollY > 200) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <TabContext.Provider value={select}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-start justify-between gap-3 p-5">
              {profile}
              {/* On a phone the sign-out sits by the name; the sidebar has room for it below. */}
              <div className="lg:hidden">{signOut}</div>
            </div>

            <nav
              ref={navRef}
              aria-label="Account sections"
              className="flex gap-1 overflow-x-auto border-t border-line p-2 lg:flex-col lg:overflow-visible"
            >
              {tabs.map((tab) => {
                const current = tab.id === active;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => select(tab.id)}
                    aria-current={current ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors lg:w-full ${
                      current
                        ? "bg-brand-50 text-brand-700"
                        : "text-muted hover:bg-elevated hover:text-fg"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.attention && (
                      <span className="size-1.5 rounded-full bg-warn" aria-label="needs attention" />
                    )}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs tabular-nums ${
                          current ? "bg-surface text-brand-700" : "bg-elevated text-muted"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="hidden border-t border-line p-2 lg:block">{signOut}</div>
          </div>
        </aside>

        <div className="min-w-0">
          {ACCOUNT_TABS.map((id) => (
            <div key={id} hidden={id !== active}>
              {panels[id]}
            </div>
          ))}
        </div>
      </div>
    </TabContext.Provider>
  );
}

/** A button anywhere inside the dashboard that switches to another tab ("View all orders"). */
export function TabLink({
  tab,
  className,
  children,
}: {
  tab: AccountTab;
  className?: string;
  children: React.ReactNode;
}) {
  const select = useContext(TabContext);
  return (
    <button type="button" onClick={() => select(tab)} className={className}>
      {children}
    </button>
  );
}
