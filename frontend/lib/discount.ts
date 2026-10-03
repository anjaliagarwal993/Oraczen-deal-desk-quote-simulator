// Presentation helpers for the discount fields. They only FORMAT values the API already calculated.
import type { Calculation } from "./types";

export const fmtPct = (n: number | null | undefined): string => (n === null || n === undefined ? "Not provided" : `${n}%`);

export const pointsText = (n: number): string => `${Math.abs(n)} percentage point${Math.abs(n) === 1 ? "" : "s"}`;

/** "Pending" until a manager approves, then the approved percentage. */
export const approvedLabel = (approvedPct: number | null): string => (approvedPct === null ? "Pending" : `${approvedPct}%`);

/** Rows for the "Discount negotiation" box. Returns null when the customer's request was not entered. */
export function negotiationRows(c: Pick<Calculation, "customer_requested_discount_pct" | "proposed_discount_pct" | "difference_percentage_points" | "tier_max_discount_pct">) {
  if (c.customer_requested_discount_pct === null || c.difference_percentage_points === null) return null;
  return [
    { label: "Customer requested", value: fmtPct(c.customer_requested_discount_pct) },
    { label: "Your proposal", value: fmtPct(c.proposed_discount_pct) },
    { label: "Tier maximum", value: fmtPct(c.tier_max_discount_pct) },
    { label: "Difference", value: pointsText(c.difference_percentage_points) },
  ];
}
