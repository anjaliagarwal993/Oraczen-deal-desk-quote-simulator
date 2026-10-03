// Deal health: a simple label made ONLY from fields the API already returns. No scoring.
import type { QuoteSummary, Stats } from "./types";

export type Health = "healthy" | "review" | "approval";

/**
 * Rules (checked in this order):
 *  1. approval : still open (draft/submitted) AND approval is required
 *  2. review   : the quote was rejected
 *  3. healthy  : everything else (approved, or open and no approval needed)
 */
export function healthOf(q: Pick<QuoteSummary, "status" | "approval_required">): Health {
  if ((q.status === "draft" || q.status === "submitted") && q.approval_required) return "approval";
  if (q.status === "rejected") return "review";
  return "healthy";
}

/** Same three rules, applied to the dashboard totals (the counts add up to stats.count). */
export function healthCounts(s: Stats): Record<Health, number> {
  const open = s.by_status.draft + s.by_status.submitted;
  return { approval: s.needs_approval, review: s.by_status.rejected, healthy: s.by_status.approved + open - s.needs_approval };
}

export const HEALTH_LABEL: Record<Health, string> = { healthy: "Healthy", review: "Needs review", approval: "Approval required" };
