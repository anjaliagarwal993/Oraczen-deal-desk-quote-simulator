"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import QuotePreview from "../../../components/QuotePreview";
import { EmptyState, ErrorCard, Skeleton } from "../../../components/StateCards";
import { compareQuotes, listQuotes, toErrors } from "../../../lib/api";
import { approvedLabel, fmtPct } from "../../../lib/discount";
import { formatMoney } from "../../../lib/format";
import type { Comparison, Quote, QuoteSummary } from "../../../lib/types";

/** Step 1: choose two saved quotes. Pressing Compare reloads this page as /compare?a=...&b=... */
function Picker({ a, b }: { a?: string; b?: string }) {
  const [items, setItems] = useState<QuoteSummary[] | null>(null);
  const [first, setFirst] = useState(a ?? "");
  const [second, setSecond] = useState(b ?? "");
  const [error, setError] = useState("");
  useEffect(() => { listQuotes().then(setItems).catch((e) => setError(toErrors(e)[0].message)); }, []);

  if (error) return <ErrorCard message={error} />;
  if (!items) return <Skeleton rows={2} />;
  if (items.length < 2) {
    return <EmptyState title="You need at least two quotes to compare." text="Save a quote, then open it and press Create scenario B to make a variation." cta />;
  }
  const label = (q: QuoteSummary) => `${q.id} · ${q.customer_name} · ${formatMoney(q.total_cents)}`;
  const ready = first !== "" && second !== "" && first !== second;
  return (
    <div className="cmp-pick">
      <label>Scenario A
        <select value={first} onChange={(e) => setFirst(e.target.value)}>
          <option value="">Choose a quote…</option>{items.map((q) => <option key={q.id} value={q.id}>{label(q)}</option>)}
        </select>
      </label>
      <label>Scenario B
        <select value={second} onChange={(e) => setSecond(e.target.value)}>
          <option value="">Choose a quote…</option>{items.map((q) => <option key={q.id} value={q.id}>{label(q)}</option>)}
        </select>
      </label>
      <button className="primary" disabled={!ready} onClick={() => window.location.assign(`/compare?a=${encodeURIComponent(first)}&b=${encodeURIComponent(second)}`)}>Compare</button>
      {first !== "" && first === second && <small className="err">Pick two different quotes.</small>}
    </div>
  );
}

/** One row per value. A row is highlighted when A and B show different text (we compare what the API returned). */
function rows(q: Quote): [string, string][] {
  const c = q.calculation;
  return [
    ["Customer", q.customer_name], ["Seats", String(q.seats)], ["Tier", c.tier],
    ["Customer requested", fmtPct(c.customer_requested_discount_pct)], ["Proposed discount", fmtPct(c.proposed_discount_pct)],
    ["Approved discount", approvedLabel(q.approved_discount_pct)], ["Annual commitment", c.annual_commitment ? "Yes" : "No"],
    ["Subtotal", formatMoney(c.subtotal_cents)], ["Discount amount", `−${formatMoney(c.discount_amount_cents)}`],
    ["Total", formatMoney(c.total_cents)], ["Approval required", c.approval_required ? "Yes" : "No"], ["Status", q.status],
  ];
}

export default function Compare() {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [ids, setIds] = useState<{ a?: string; b?: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const [a, b] = [p.get("a") ?? undefined, p.get("b") ?? undefined];
    setIds({ a, b });
    if (a && b) compareQuotes(a, b).then(setData).catch((e) => setError(toErrors(e)[0].message));
  }, []);

  if (!ids) return <Skeleton rows={3} />;
  const picking = (
    <section className="card">
      <h2>Compare scenarios</h2>
      <p className="muted">Choose two saved quotes to see exactly what changed from A to B.</p>
      <Picker a={ids.a} b={ids.b} />
    </section>
  );
  if (!ids.a || !ids.b) return picking;
  if (error) return <>{picking}<ErrorCard message={error} hint="Check both quote IDs, or choose two quotes again." /></>;
  if (!data) return <>{picking}<Skeleton rows={4} /></>;

  const ra = rows(data.a), rb = rows(data.b);
  return (
    <div>
      {picking}
      <section className="card">
        <h2>What changed: A → B</h2>
        <ul>{data.differences.map((d) => <li key={d}>{d}</li>)}</ul>
      </section>
      <section className="card">
        <h3>Side by side</h3>
        <div className="table-wrap">
          <table className="cmp-table">
            <thead><tr><th>Metric</th><th>Scenario A · {data.a.id}</th><th>Scenario B · {data.b.id}</th><th /></tr></thead>
            <tbody>
              {ra.map(([label, va], i) => {
                const vb = rb[i][1], changed = va !== vb;
                return (
                  <tr key={label} className={changed ? "changed" : ""}>
                    <td>{label}</td><td>{va}</td><td>{vb}</td>
                    <td>{changed && <span className="badge chg">Changed</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid">
        {([["A", data.a], ["B", data.b]] as const).map(([label, q]) => (
          <section className="card" key={label}>
            <h3>Scenario {label}: {q.customer_name} <small className="muted">{q.id}</small></h3>
            <QuotePreview calc={q.calculation} />
            <Link href={`/quotes/${q.id}`}>Open quote →</Link>
          </section>
        ))}
      </div>
    </div>
  );
}
