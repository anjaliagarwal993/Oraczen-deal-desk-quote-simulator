import { approvedLabel, fmtPct } from "../lib/discount";
import { formatMoney } from "../lib/format";
import type { Quote } from "../lib/types";

/** Customer requested -> salesperson proposed -> tier maximum -> manager approved, kept visibly separate. */
export default function DiscountLifecycle({ quote }: { quote: Quote }) {
  const c = quote.calculation;
  const a = quote.approved;
  const rows: [string, string][] = [
    ["Customer requested", fmtPct(c.customer_requested_discount_pct)],
    ["Salesperson proposed", fmtPct(c.proposed_discount_pct)],
    ["Tier maximum", fmtPct(c.tier_max_discount_pct)],
    ["Approval threshold", fmtPct(c.limits.approval_discount_pct)],
    ["Manager approved", approvedLabel(quote.approved_discount_pct)],
    ["Subtotal", formatMoney(c.subtotal_cents)],
    ["Proposed discount", `−${formatMoney(c.discount_amount_cents)}`],
    ["Proposed total", formatMoney(c.total_cents)],
    ["Approved discount", a ? `−${formatMoney(a.discount_amount_cents)}` : "Pending"],
    ["Final approved total", a ? formatMoney(a.total_cents) : "Pending"],
  ];
  return (
    <div className="lifecycle">
      <h3>Discount summary</h3>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p><b>Approval required: {c.approval_required ? "YES" : "No"}</b>
        {c.approval_messages.length > 0 && <> · {c.approval_messages.join(" ")}</>}</p>
    </div>
  );
}
