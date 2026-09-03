"use client";

import { useState, type ReactNode } from "react";
import type { Session } from "@/components/education/Sessions";

export type FilterableCampaign = {
  id: string;
  format: Session["format"];
  /** "" when the campaign has no venue set — such a campaign never produces a chip. */
  venue: string;
  /** Rendered on the server; this component only decides whether to show it. */
  card: ReactNode;
};

type Filter = { type: "format" | "venue"; value: string };

const formatLabel = (f: Session["format"]) => (f === "online" ? "Online" : "In person");

/**
 * Campaign list with filter chips.
 *
 * Filtering is client-side rather than URL-driven on purpose: the page is statically prerendered
 * with an hourly revalidate, and reading `searchParams` would make it dynamic — a Firestore round
 * trip per visit to filter a handful of cards that are already in the DOM. Every campaign ships in
 * the initial HTML either way, so nothing is hidden from search engines.
 *
 * Options are derived from the campaigns themselves, and a group with fewer than two distinct
 * values isn't rendered at all — no dropdown that offers a single choice, and no chip that can
 * match zero cards.
 */
export function CampaignFilters({ campaigns }: { campaigns: FilterableCampaign[] }) {
  const [filter, setFilter] = useState<Filter | null>(null);

  const formats = [...new Set(campaigns.map((c) => c.format))];
  const venues = [...new Set(campaigns.map((c) => c.venue).filter(Boolean))];
  const chips: Filter[] = [
    ...(formats.length > 1 ? formats.map((f) => ({ type: "format" as const, value: f })) : []),
    ...(venues.length > 1 ? venues.map((v) => ({ type: "venue" as const, value: v })) : []),
  ];

  const visible = filter
    ? campaigns.filter((c) =>
        filter.type === "format" ? c.format === filter.value : c.venue === filter.value,
      )
    : campaigns;

  return (
    <div>
      {chips.length > 0 && (
        <>
          <div role="group" aria-label="Filter campaigns" className="flex flex-wrap gap-2">
            <Chip active={filter === null} onClick={() => setFilter(null)}>
              All
            </Chip>
            {chips.map((c) => {
              const active = filter?.type === c.type && filter.value === c.value;
              return (
                <Chip key={`${c.type}:${c.value}`} active={active} onClick={() => setFilter(c)}>
                  {c.type === "format" ? formatLabel(c.value as Session["format"]) : c.value}
                </Chip>
              );
            })}
          </div>

          {filter && (
            <p className="mt-3 text-sm text-muted">
              Showing {visible.length} of {campaigns.length} campaign
              {campaigns.length === 1 ? "" : "s"}
            </p>
          )}
        </>
      )}

      <div className={chips.length > 0 ? "mt-6 space-y-6" : "space-y-6"}>
        {visible.map((c) => (
          <div key={c.id}>{c.card}</div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-surface text-fg hover:bg-elevated hover:text-brand-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
