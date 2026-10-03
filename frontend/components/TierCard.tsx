import type { Calculation, DiscountRule } from "../lib/types";

/** Tier policy: proposed discount as a share of the tier maximum (e.g. 18 / 20 = 90%). */
export default function TierCard({ calc, rules }: { calc: Calculation; rules?: DiscountRule[] }) {
  const rule = rules?.find((r) => r.code === calc.tier);
  const max = calc.tier_max_discount_pct;
  const pct = max > 0 ? Math.min(100, Math.round((calc.proposed_discount_pct / max) * 100)) : 0;
  const over = calc.proposed_discount_pct > max;
  return (
    <div className={over ? "tier-card over" : "tier-card"}>
      <div className="tier-name">{calc.tier}</div>
      {rule && <small className="muted">{rule.min_seats}{rule.max_seats >= 99999 ? "+" : `–${rule.max_seats}`} seats</small>}
      <div className="row"><span>Proposed discount</span><b>{calc.proposed_discount_pct}%</b></div>
      <div className="row"><span>Policy maximum</span><b>{max}%</b></div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Share of tier maximum used">
        <div className={over ? "fill over" : "fill"} style={{ width: `${pct}%` }} />
      </div>
      <small className={over ? "err" : "ok-text"}>{over ? "✕ Above tier policy maximum" : `✓ Within tier policy (${pct}% of maximum used)`}</small>
    </div>
  );
}
