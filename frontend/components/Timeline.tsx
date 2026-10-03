import { fmtPct } from "../lib/discount";
import { formatDate } from "../lib/format";
import type { HistoryEntry } from "../lib/types";

/** Vertical timeline of the quote history. Only fields the API stored are shown (no invented timestamps). */
export default function Timeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="vtimeline">
      {history.map((h, i) => (
        <li key={i} className={`tl-${h.to}`}>
          <b>{h.note ?? h.to}</b>
          <span className="muted">{h.from ? `${h.from} → ${h.to} · ` : ""}{formatDate(h.at)}</span>
          {h.approved_discount_pct !== undefined && <span>Approved discount: {fmtPct(h.approved_discount_pct)}</span>}
          {h.comment && <span className="muted">“{h.comment}”</span>}
        </li>
      ))}
    </ol>
  );
}
