// Shapes returned by the Python API. The frontend only DISPLAYS these; it never recalculates them.
export interface Product { sku: string; name: string; unit_price_cents: number }
export interface DiscountRule { code: string; min_seats: number; max_seats: number; max_discount_pct: number }
export interface Limits { approval_discount_pct: number; annual_discount_pct: number; approval_total_cents: number }
export interface Catalog { currency: string; products: Product[]; discount_rules: DiscountRule[]; limits: Limits }

export interface CalcLine { sku: string; name: string; quantity: number; unit_price_cents: number; line_total_cents: number }
export interface Calculation {
  tier: string; tier_max_discount_pct: number; seats: number; lines: CalcLine[];
  subtotal_cents: number; discount_amount_cents: number; total_cents: number;
  // Four different things: requested (information), proposed (the quoted discount), tier max (policy limit), approved (manager).
  customer_requested_discount_pct: number | null; proposed_discount_pct: number;
  difference_percentage_points: number | null; negotiation_message: string | null;
  policy_message: string | null; requested_exceeds_tier_max: boolean;
  annual_commitment: boolean; approval_required: boolean;
  approval_reasons: string[]; approval_messages: string[]; limits: Limits;
}
export interface Resolution {
  id: string; title: string; description: string; changes: Partial<DraftInput> | null;
  removes_approval: boolean; removed_reasons: string[]; remaining_reasons: string[];
}
export interface CalcResponse extends Calculation { explanation: string[]; coach: string[]; resolutions: Resolution[] }

export type Status = "draft" | "submitted" | "approved" | "rejected";
export interface HistoryEntry { from: Status | null; to: Status; at: string; note?: string; comment?: string; approved_discount_pct?: number }
export interface Quote {
  id: string; customer_name: string; seats: number; annual_commitment: boolean;
  customer_requested_discount_pct: number | null; proposed_discount_pct: number;
  approved_discount_pct: number | null; approved: { discount_amount_cents: number; total_cents: number } | null;
  status: Status; history: HistoryEntry[]; created_at: string; updated_at: string;
  calculation: Calculation; explanation: string[]; allowed_transitions: Status[]; warnings: string[];
}
export interface QuoteSummary {
  id: string; customer_name: string; status: Status; seats: number; tier: string;
  total_cents: number; approval_required: boolean; created_at: string;
  customer_requested_discount_pct: number | null; proposed_discount_pct: number;
  approved_discount_pct: number | null; final_total_cents: number | null;
}
export interface Comparison { a: Quote; b: Quote; differences: string[] }

// What the form sends to the API (seats/quantity can be null while the rep is typing).
export interface DraftLine { sku: string; quantity: number | null }
export interface DraftInput {
  customer_name: string; seats: number | null; lines: DraftLine[];
  customer_requested_discount_pct: number | null; proposed_discount_pct: number; annual_commitment: boolean;
}
export interface ApiErrorItem { field?: string; code: string; message: string }

export interface Stats {
  count: number; by_status: Record<Status, number>; value_by_status_cents: Record<Status, number>;
  needs_approval: number; recent: QuoteSummary[];
}

export interface AuthUser { id: string; name: string; email: string }
export interface AuthSession { token: string; user: AuthUser }
