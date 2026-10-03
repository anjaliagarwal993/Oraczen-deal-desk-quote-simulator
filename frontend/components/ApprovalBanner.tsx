import type { Calculation } from "../lib/types";
import { formatMoney } from "../lib/format";

/** Big status banner. Everything shown comes from the API's approval_required / reasons / messages. */
export default function ApprovalBanner({ calc, showResolveLink }: { calc: Calculation; showResolveLink?: boolean }) {
  const L = calc.limits;
  if (!calc.approval_required) {
    return (
      <div className="banner ready">
        <b>✓ READY TO QUOTE</b>
        <p>This quote currently satisfies approval requirements.</p>
      </div>
    );
  }
  // One "Proposed vs Threshold" fact per reason the API returned.
  const facts: [string, string, string][] = [];
  if (calc.approval_reasons.includes("discount_above_15_percent")) facts.push(["Proposed discount", `${calc.proposed_discount_pct}%`, `${L.approval_discount_pct}%`]);
  if (calc.approval_reasons.includes("annual_commitment_discount_above_10_percent")) facts.push(["Proposed (annual commitment)", `${calc.proposed_discount_pct}%`, `${L.annual_discount_pct}%`]);
  if (calc.approval_reasons.includes("total_above_25000")) facts.push(["Total", formatMoney(calc.total_cents), formatMoney(L.approval_total_cents)]);
  return (
    <div className="banner needed" role="status">
      <b>⚠ APPROVAL REQUIRED</b>
      <p>This quote needs manager approval.</p>
      <ul>{calc.approval_messages.map((m) => <li key={m}>{m}</li>)}</ul>
      <dl className="banner-facts">
        {facts.map(([label, value, limit]) => (
          <div key={label}><dt>{label}</dt><dd><span className="flash" key={value}>{value}</span> <span className="muted">vs threshold {limit}</span></dd></div>
        ))}
      </dl>
      {showResolveLink && <a className="no-print" href="#approval-resolution">See how to resolve →</a>}
    </div>
  );
}
