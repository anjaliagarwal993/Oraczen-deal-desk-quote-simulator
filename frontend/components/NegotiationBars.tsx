import { approvedLabel, fmtPct } from "../lib/discount";

interface Props {
  requested: number | null; proposed: number; max: number | null; approved?: number | null;
  message?: string | null; // sentence from the API, e.g. "Customer asked for 4 percentage points more."
}

/** One row: label, a bar whose width = value / scale, and the value. */
function Bar({ label, value, scale, kind }: { label: string; value: number | null; scale: number; kind: string }) {
  const width = value === null ? 0 : Math.min(100, (value / scale) * 100);
  return (
    <div className="nbar">
      <span className="nbar-label">{label}</span>
      <div className="bar"><div className={`fill ${kind}`} style={{ width: `${width}%` }} /></div>
      <b className="nbar-value">{fmtPct(value)}</b>
    </div>
  );
}

/** Requested vs proposed vs policy maximum, drawn on the same scale so the gap is visible. */
export default function NegotiationBars({ requested, proposed, max, approved, message }: Props) {
  const scale = Math.max(requested ?? 0, proposed, max ?? 0, approved ?? 0, 1);
  const gap = requested === null ? null : Math.round((requested - proposed) * 100) / 100;
  return (
    <div className="negbars">
      <div className="neg-headline">
        <div><small>Customer asked</small><b>{requested === null ? "—" : `${requested}%`}</b></div>
        <div><small>Your proposal</small><b>{proposed}%</b></div>
        {gap !== null && <div className="gap"><small>Gap</small><b>{Math.abs(gap)} pp</b></div>}
      </div>
      {requested !== null && <Bar label="Customer request" value={requested} scale={scale} kind="req" />}
      <Bar label="Your proposal" value={proposed} scale={scale} kind="prop" />
      {max !== null && <Bar label="Policy maximum" value={max} scale={scale} kind="max" />}
      {approved !== undefined && <Bar label="Manager approved" value={approved} scale={scale} kind="ok" />}
      {approved === null && <small className="muted">{approvedLabel(approved)}: no manager decision yet.</small>}
      {message && <p className="neg-msg">{message}</p>}
    </div>
  );
}
