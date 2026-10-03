"use client";
import { useState } from "react";
import type { Calculation, DraftInput, Resolution } from "../lib/types";

const LABELS: Record<string, string> = { proposed_discount_pct: "Proposed discount", annual_commitment: "Annual commitment" };
const show = (key: string, v: unknown) => (key === "proposed_discount_pct" ? `${v}%` : v === true ? "On" : v === false ? "Off" : String(v));

/**
 * "Ways to remove approval". Preview only changes which card is expanded (React state): nothing is saved or applied.
 * Apply calls the same onApply the builder already had.
 */
export default function ApprovalResolution({ calc, draft, resolutions, onApply }: {
  calc: Calculation; draft?: DraftInput | null; resolutions: Resolution[]; onApply?: (c: NonNullable<Resolution["changes"]>) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  if (resolutions.length === 0) return null;
  const before = (key: string) => (key === "proposed_discount_pct" ? calc.proposed_discount_pct : draft ? draft[key as keyof DraftInput] : calc.annual_commitment);
  return (
    <div className="ways no-print" id="approval-resolution">
      <b>APPROVAL RESOLUTION</b>
      <p className="muted">Current state: {calc.proposed_discount_pct}% proposed · approval required. Preview shows the effect; nothing changes until you press Apply.</p>
      {resolutions.map((r, i) => (
        <div className="way" key={r.id}>
          <div>
            <b>Option {i + 1}: {r.title}</b>
            <p>Approval: <span className="badge warn">REQUIRED</span> → <span className={r.removes_approval ? "badge ok" : "badge warn"}>{r.removes_approval ? "NOT REQUIRED" : "STILL REQUIRED"}</span></p>
            {previewId === r.id && (
              <div className="preview-box" role="region" aria-label={`Preview of option ${i + 1}`}>
                <p>{r.description}</p>
                {r.changes ? (
                  <ul>{Object.entries(r.changes).map(([k, v]) => <li key={k}>{LABELS[k] ?? k}: {show(k, before(k))} → <b>{show(k, v)}</b></li>)}</ul>
                ) : <p className="muted">This option needs a manual change, so it cannot be applied automatically.</p>}
              </div>
            )}
          </div>
          <div className="way-actions">
            <button aria-pressed={previewId === r.id} onClick={() => setPreviewId(previewId === r.id ? null : r.id)}>{previewId === r.id ? "Hide preview" : "Preview"}</button>
            {r.changes && onApply && <button className="primary" onClick={() => { onApply(r.changes!); setPreviewId(null); }}>Apply</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
