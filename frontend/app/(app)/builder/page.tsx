"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import InfoTip from "../../../components/InfoTip";
import NegotiationBars from "../../../components/NegotiationBars";
import QuotePreview from "../../../components/QuotePreview";
import { ErrorCard, Skeleton } from "../../../components/StateCards";
import { formatMoney } from "../../../lib/format";
import { calculate, createQuote, getCatalog, getQuote, toErrors } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { clearDraft, loadDraft, saveDraft } from "../../../lib/draft";
import type { ApiErrorItem, CalcResponse, Catalog, DraftInput } from "../../../lib/types";

export default function Builder() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<DraftInput | null>(null);
  const [calc, setCalc] = useState<CalcResponse | null>(null);
  const [errors, setErrors] = useState<ApiErrorItem[]>([]);
  const [saveErrors, setSaveErrors] = useState<ApiErrorItem[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null); // set after a successful save
  const seq = useRef(0); // ignore out-of-order responses

  // 1. Load catalog, then start from: scenario source (?from=) > recovered draft > blank form
  useEffect(() => {
    (async () => {
      try {
        const cat = await getCatalog();
        setCatalog(cat);
        const blank: DraftInput = {
          customer_name: "", seats: 10, customer_requested_discount_pct: null, proposed_discount_pct: 0, annual_commitment: false,
          lines: [{ sku: cat.products[0].sku, quantity: 1 }],
        };
        const from = new URLSearchParams(window.location.search).get("from");
        if (from) {
          const q = await getQuote(from);
          setDraft({
            customer_name: q.customer_name, seats: q.seats,
            customer_requested_discount_pct: q.customer_requested_discount_pct, proposed_discount_pct: q.proposed_discount_pct,
            annual_commitment: q.annual_commitment,
            lines: q.calculation.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
          });
          setNotice(`Scenario based on ${q.id}. Change something and save it, then compare the two.`);
          return;
        }
        const saved = loadDraft();
        if (saved) setNotice("Draft restored from your last visit.");
        setDraft(saved ?? blank);
      } catch (e) {
        setErrors(toErrors(e));
      }
    })();
  }, []);

  // 2. Live preview: wait 300ms after the last keystroke, ask the API, and keep the draft in localStorage.
  useEffect(() => {
    if (!draft) return;
    saveDraft(draft);
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await calculate(draft);
        if (id === seq.current) { setCalc(r); setErrors([]); }
      } catch (e) {
        if (id === seq.current) { setCalc(null); setErrors(toErrors(e)); }
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft]);

  if (!draft || !catalog) {
    return errors.length ? <ErrorCard message={errors.map((e) => e.message).join(" ")} /> : <Skeleton rows={4} />;
  }

  const set = (patch: Partial<DraftInput>) => setDraft({ ...draft, ...patch });
  const setLine = (i: number, patch: Partial<DraftInput["lines"][number]>) =>
    set({ lines: draft.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const num = (v: string) => (v === "" ? null : Number(v));
  // The API's line total for row i (only when the API's line is the same product, otherwise we show nothing).
  const apiLine = (i: number) => (calc && calc.lines[i]?.sku === draft.lines[i].sku ? calc.lines[i] : null);

  async function save() {
    setSaving(true);
    setSaveErrors([]);
    try {
      const q = await createQuote(draft!);
      clearDraft();
      setSavedId(q.id);
      toast("Quote saved", `${q.id} was saved.`);
    } catch (e) {
      setSaveErrors(toErrors(e));
    } finally {
      setSaving(false);
    }
  }

  if (savedId) {
    return (
      <section className="card saved-card" role="status">
        <div className="saved-tick" aria-hidden="true">✓</div>
        <h2>Quote saved</h2>
        <p className="muted">Quote ID: <b>{savedId}</b></p>
        <Link className="btn primary" href={`/quotes/${savedId}`}>View quote</Link>
      </section>
    );
  }

  return (
    <div>
      <div className="hero">
        <div><h1>Quote workspace</h1><p>Customer → products → negotiation → terms → review. The preview updates as you type.</p></div>
      </div>
      <div className="grid builder">
        <div>
          {notice && (
            <div className="notice">
              {notice}{" "}
              <button className="link" onClick={() => { clearDraft(); window.location.href = "/builder"; }}>Start over</button>
            </div>
          )}

          <section className="card step">
            <h2 className="step-title"><span className="step-no">01</span>Customer</h2>
            <label htmlFor="customer">Customer name</label>
            <input id="customer" value={draft.customer_name} onChange={(e) => set({ customer_name: e.target.value })} placeholder="Acme Corp" />
            <label htmlFor="seats">Seats</label>
            <input id="seats" type="number" value={draft.seats ?? ""} onChange={(e) => set({ seats: num(e.target.value) })} />
          </section>

          <section className="card step">
            <h2 className="step-title"><span className="step-no">02</span>Products</h2>
            {draft.lines.map((l, i) => {
              const product = catalog.products.find((p) => p.sku === l.sku);
              const line = apiLine(i);
              return (
                <div className="product-row" key={i}>
                  <div className="product-main">
                    <select aria-label={`Product for line ${i + 1}`} value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })}>
                      {catalog.products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                    </select>
                    <small className="muted">{product ? `${formatMoney(product.unit_price_cents)} / seat` : ""}</small>
                  </div>
                  <input type="number" aria-label={`Quantity for line ${i + 1}`} value={l.quantity ?? ""}
                    onChange={(e) => setLine(i, { quantity: num(e.target.value) })} />
                  <b className="line-total flash" key={line?.line_total_cents}>{line ? formatMoney(line.line_total_cents) : "—"}</b>
                  <button className="remove" onClick={() => set({ lines: draft.lines.filter((_, idx) => idx !== i) })} aria-label={`Remove line ${i + 1}`}>✕</button>
                </div>
              );
            })}
            <button onClick={() => set({ lines: [...draft.lines, { sku: catalog.products[0].sku, quantity: 1 }] })}>+ Add product</button>
          </section>

          <section className="card step">
            <h2 className="step-title"><span className="step-no">03</span>Negotiation</h2>
            <div className="field-head"><label htmlFor="requested">Customer requested discount (%)</label>
              <InfoTip text="What the customer asked for. It does not affect quote pricing." /></div>
            <input id="requested" type="number" step="0.5" min="0" placeholder="What the customer asked for" value={draft.customer_requested_discount_pct ?? ""}
              onChange={(e) => set({ customer_requested_discount_pct: num(e.target.value) })} />
            <span className="hint">Information only. It never changes the price or the approval rules.</span>
            <div className="field-head"><label htmlFor="proposed">Your proposed discount (%)</label>
              <InfoTip text="The discount offered by the salesperson. This controls pricing and approval." /></div>
            <input id="proposed" type="number" step="0.5" min="0" value={draft.proposed_discount_pct}
              onChange={(e) => set({ proposed_discount_pct: Number(e.target.value || 0) })} />
            <span className="hint">This is the discount used for the quote, the tier limit and approval.</span>
            <NegotiationBars requested={draft.customer_requested_discount_pct} proposed={draft.proposed_discount_pct}
              max={calc ? calc.tier_max_discount_pct : null} message={calc?.negotiation_message} />
          </section>

          <section className="card step">
            <h2 className="step-title"><span className="step-no">04</span>Terms</h2>
            <div className="check-row">
              <label className="check"><input type="checkbox" checked={draft.annual_commitment} onChange={(e) => set({ annual_commitment: e.target.checked })} />
                Annual commitment</label>
              <InfoTip text="Contract term used by the approval policy." />
            </div>
          </section>

          <section className="card step">
            <h2 className="step-title"><span className="step-no">05</span>Review</h2>
            <p className="muted">Check the live preview, then save. Approval rules are applied by the server when you save.</p>
            {saveErrors.map((e) => <p key={e.message} className="err" role="alert">{e.message}</p>)}
            <button className="primary" disabled={saving} onClick={save}>
              {saving ? <>Saving quote <span className="dots" aria-hidden="true"><i /><i /><i /></span></> : "Save quote"}
            </button>
          </section>
        </div>

        <section className="card sticky" aria-label="Live preview">
          <h2>Live preview</h2>
          {errors.length > 0 && (
            <div className="errbox"><b>Fix this to see your quote:</b>
              <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
            </div>
          )}
          {!calc && errors.length === 0 && <Skeleton rows={3} />}
          {calc && <QuotePreview calc={calc} explanation={calc.explanation} coach={calc.coach} resolutions={calc.resolutions}
            onApply={(c) => set(c)} draft={draft} rules={catalog.discount_rules} />}
        </section>
      </div>
    </div>
  );
}
