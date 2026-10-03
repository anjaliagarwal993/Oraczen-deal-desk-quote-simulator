"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import DiscountLifecycle from "../../../../components/DiscountLifecycle";
import NegotiationBars from "../../../../components/NegotiationBars";
import QuotePreview from "../../../../components/QuotePreview";
import { ErrorCard, Skeleton } from "../../../../components/StateCards";
import Timeline from "../../../../components/Timeline";
import { changeStatus, download, getQuote, toErrors } from "../../../../lib/api";
import { fmtPct } from "../../../../lib/discount";
import { formatDate, formatMoney } from "../../../../lib/format";
import { toast } from "../../../../lib/toast";
import type { Quote, Status } from "../../../../lib/types";

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(""); // manager's approved discount (text so it can be edited freely)
  const [comment, setComment] = useState("");

  useEffect(() => {
    getQuote(id).then((q) => { setQuote(q); setApproved(String(q.proposed_discount_pct)); })
      .catch((e) => setError(toErrors(e)[0].message));
  }, [id]);

  async function move(status: Status, extra: { approved_discount_pct?: number; comment?: string } = {}) {
    setError("");
    setBusy(true);
    try {
      const q = await changeStatus(id, status, extra);
      setQuote(q);
      if (status === "submitted") toast("Submitted for approval", `${q.id} is now waiting for a manager.`);
      if (status === "approved") toast("Quote approved", `Approved at ${fmtPct(q.approved_discount_pct)}. Final total ${formatMoney(q.approved!.total_cents)}.`);
      if (status === "rejected") toast("Quote rejected", "The reason was saved in the history.");
    } catch (e) {
      setError(toErrors(e)[0].message); // the API validates the approved discount; show its message
    } finally {
      setBusy(false);
    }
  }

  async function downloadCsv() {
    try {
      await download(`/api/quotes/${encodeURIComponent(id)}/export.csv`, `${id}.csv`);
      toast("Download started", `${id}.csv was saved to your downloads folder.`);
    } catch (e) {
      toast("Download failed", toErrors(e)[0].message, "error");
    }
  }

  if (!quote) return error ? <ErrorCard message={error} /> : <Skeleton rows={4} />;
  const c = quote.calculation;

  return (
    <section className="card review-doc">
      <div className="print-only"><b>Deal Desk</b> · Quote {quote.id} · printed {new Date().toLocaleDateString()}</div>
      <div className="row">
        <h2>{quote.customer_name} <small className="muted">{quote.id}</small></h2>
        <span className={`badge s-${quote.status}`}>{quote.status === "submitted" ? "pending approval" : quote.status}</span>
      </div>
      <p className="muted no-print">{quote.seats} seats · {c.tier} · created {formatDate(quote.created_at)}{quote.annual_commitment ? " · annual commitment" : ""}</p>

      {quote.warnings.map((w) => <div className="notice" key={w}>⚠ {w}</div>)}
      {error && <p className="err" role="alert">{error}</p>}

      <dl className="doc-header">
        <div><dt>Customer</dt><dd>{quote.customer_name}</dd></div>
        <div><dt>Quote ID</dt><dd>{quote.id}</dd></div>
        <div><dt>Tier</dt><dd>{c.tier}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(quote.created_at)}</dd></div>
      </dl>

      <h3>Negotiation summary</h3>
      <NegotiationBars requested={c.customer_requested_discount_pct} proposed={c.proposed_discount_pct}
        max={c.tier_max_discount_pct} approved={quote.approved_discount_pct} message={c.negotiation_message} />

      <h3>Pricing and approval</h3>
      <QuotePreview calc={c} explanation={quote.explanation} />
      <DiscountLifecycle quote={quote} />

      {quote.status === "submitted" && (
        <div className="approval no-print">
          <span className="internal-tag">Internal · not part of the quote document</span>
          <h3>Approval review</h3>
          <dl className="approval-facts">
            <div><dt>Customer</dt><dd>{quote.customer_name}</dd></div>
            <div><dt>Seats</dt><dd>{quote.seats} ({c.tier})</dd></div>
            <div><dt>Customer requested</dt><dd>{fmtPct(c.customer_requested_discount_pct)}</dd></div>
            <div><dt>Salesperson proposed</dt><dd>{fmtPct(c.proposed_discount_pct)}</dd></div>
            <div><dt>Tier maximum</dt><dd>{fmtPct(c.tier_max_discount_pct)}</dd></div>
          </dl>
          <p><b>Current approval triggers</b></p>
          {c.approval_messages.length === 0 ? <p className="muted">None. This quote did not need approval.</p>
            : <ul className="triggers">{c.approval_messages.map((m) => <li key={m}>✓ {m}</li>)}</ul>}
          <label>Approved discount (%)
            <input type="number" step="0.5" min="0" value={approved} onChange={(e) => setApproved(e.target.value)} />
            <span className="hint">Cannot be higher than the proposal or the tier maximum. Your proposal ({fmtPct(c.proposed_discount_pct)}) is kept in the history.</span>
          </label>
          <label>Comment or rejection reason (optional)
            <textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Discount is too high for this customer segment." />
          </label>
          <div className="row">
            <button className="primary" disabled={busy}
              onClick={() => move("approved", { approved_discount_pct: approved === "" ? undefined : Number(approved), comment })}>Approve Quote</button>
            <button className="danger" disabled={busy} onClick={() => move("rejected", { comment })}>Reject Quote</button>
          </div>
        </div>
      )}

      <div className="row actions no-print">
        {quote.status === "draft" && <button className="primary" disabled={busy} onClick={() => move("submitted")}>Submit for approval</button>}
        {quote.allowed_transitions.length === 0 && <small className="muted">This status is final.</small>}
        <Link className="btn" href={`/builder?from=${quote.id}`}>Create scenario B</Link>
        <button onClick={downloadCsv}>Download CSV</button>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <h3>History</h3>
      <Timeline history={quote.history} />
    </section>
  );
}
