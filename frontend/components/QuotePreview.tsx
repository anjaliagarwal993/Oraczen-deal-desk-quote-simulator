"use client";
import { useState } from "react";
import { formatMoney } from "../lib/format";
import { negotiationRows } from "../lib/discount";
import type { Calculation, DiscountRule, DraftInput, Resolution } from "../lib/types";
import ApprovalBanner from "./ApprovalBanner";
import ApprovalResolution from "./ApprovalResolution";
import DealIntelligence from "./DealIntelligence";
import TierCard from "./TierCard";

function Meter(props: { label: string; value: number; scaleMax: number; valueText: string; over: boolean; legend: string }) {
  const pct = (n: number) => `${Math.min(100, (n / props.scaleMax) * 100)}%`;
  return (
    <div className="meter">
      <div className="row"><span>{props.label}</span><b>{props.valueText}</b></div>
      <div className="bar"><div className={props.over ? "fill over" : "fill"} style={{ width: pct(props.value) }} /></div>
      <small className="muted">{props.legend}</small>
    </div>
  );
}

/** Shows an API calculation as a quote summary. Used by the builder (live), the review page and compare. */
interface Props {
  calc: Calculation; explanation?: string[]; coach?: string[];
  resolutions?: Resolution[]; onApply?: (changes: NonNullable<Resolution["changes"]>) => void;
  draft?: DraftInput | null; rules?: DiscountRule[];
}

export default function QuotePreview({ calc, explanation, coach, resolutions, onApply, draft, rules }: Props) {
  const rows = negotiationRows(calc);
  const [showWhy, setShowWhy] = useState(false);
  const [copied, setCopied] = useState(false);
  const L = calc.limits;
  const discountOver = calc.approval_reasons.some((r) => r.includes("discount"));
  const totalOver = calc.approval_reasons.includes("total_above_25000");

  async function copy() {
    try {
      await navigator.clipboard.writeText((explanation ?? []).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: user can still select the text */ }
  }

  return (
    <div className="preview">
      <ApprovalBanner calc={calc} showResolveLink={!!resolutions && resolutions.length > 0} />
      <TierCard calc={calc} rules={rules} />

      {rows && (
        <div className="nego">
          <h4>Negotiation summary</h4>
          <div className="nego-grid">{rows.map((r) => <div key={r.label}><small>{r.label}</small><b>{r.value}</b></div>)}</div>
          <p>{calc.negotiation_message}</p>
          {calc.policy_message && <p className="muted">{calc.policy_message}</p>}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Line</th></tr></thead>
          <tbody>
            {calc.lines.map((l) => (
              <tr key={l.sku}>
                <td>{l.name}</td><td className="num">{l.quantity}</td>
                <td className="num">{formatMoney(l.unit_price_cents)}</td><td className="num">{formatMoney(l.line_total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals">
        <div className="row"><span>Subtotal</span><span>{formatMoney(calc.subtotal_cents)}</span></div>
        <div className="row"><span>Proposed discount ({calc.proposed_discount_pct}%)</span><span>−{formatMoney(calc.discount_amount_cents)}</span></div>
        <div className="row total-row"><span>TOTAL</span><span className="big flash" key={calc.total_cents}>{formatMoney(calc.total_cents)}</span></div>
      </div>

      <Meter label="Discount" value={calc.proposed_discount_pct} scaleMax={calc.tier_max_discount_pct} over={discountOver}
        valueText={`${calc.proposed_discount_pct}% of ${calc.tier_max_discount_pct}% max`}
        legend={`Approval above ${L.approval_discount_pct}%${calc.annual_commitment ? ` (above ${L.annual_discount_pct}% with annual commitment)` : ""}`} />
      <Meter label="Total" value={calc.total_cents} scaleMax={Math.max(calc.total_cents, L.approval_total_cents * 1.25)} over={totalOver}
        valueText={formatMoney(calc.total_cents)} legend={`Approval above ${formatMoney(L.approval_total_cents)}`} />

      {coach && <DealIntelligence coach={coach} resolutions={resolutions} />}
      {resolutions && <ApprovalResolution calc={calc} draft={draft} resolutions={resolutions} onApply={onApply} />}

      {explanation && (
        <div className="no-print">
          <button className="link" onClick={() => setShowWhy(!showWhy)}>{showWhy ? "Hide" : "Explain pricing"}</button>
          {showWhy && (
            <div className="explain">
              {explanation.map((s, i) => <p key={i}>{s}</p>)}
              <button onClick={copy}>{copied ? "Copied!" : "Copy explanation"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
