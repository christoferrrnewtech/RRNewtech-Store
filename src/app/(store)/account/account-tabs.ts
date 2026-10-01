/**
 * The /account tab vocabulary — shared by the server page (which reads `?tab=`) and the client
 * dashboard (which switches between them). Kept out of `AccountDashboard.tsx` because that module
 * is `"use client"`, and a server component can't call a function exported from one.
 */

export const ACCOUNT_TABS = ["overview", "orders", "inquiries", "addresses"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function isAccountTab(value: unknown): value is AccountTab {
  return typeof value === "string" && (ACCOUNT_TABS as readonly string[]).includes(value);
}
