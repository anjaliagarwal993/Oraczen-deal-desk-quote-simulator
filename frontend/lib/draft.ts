import type { DraftInput } from "./types";

const KEY = "dealdesk.draft.v1";

/** Type guard: never trust whatever is sitting in localStorage. */
export function isDraft(x: unknown): x is DraftInput {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.customer_name === "string" &&
    (d.seats === null || typeof d.seats === "number") &&
    (d.customer_requested_discount_pct === null || typeof d.customer_requested_discount_pct === "number") &&
    typeof d.proposed_discount_pct === "number" &&
    typeof d.annual_commitment === "boolean" &&
    Array.isArray(d.lines) &&
    d.lines.every((l) => typeof l?.sku === "string" && (l.quantity === null || typeof l.quantity === "number"))
  );
}

/** Drafts saved before the discount negotiation fields existed only had `discount_pct` (= the proposed discount). */
export function migrateDraft(x: unknown): unknown {
  if (typeof x !== "object" || x === null) return x;
  const { discount_pct, ...rest } = x as Record<string, unknown>;
  const d = { customer_requested_discount_pct: null, ...rest } as Record<string, unknown>;
  if (d.proposed_discount_pct === undefined && typeof discount_pct === "number") d.proposed_discount_pct = discount_pct;
  return d;
}

export function loadDraft(): DraftInput | null {
  try {
    const parsed = migrateDraft(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: DraftInput): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked: ignore */ }
}

export function clearDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
