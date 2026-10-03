"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, ErrorCard, Skeleton } from "../../../components/StateCards";
import { download, listQuotes, toErrors } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { approvedLabel, fmtPct } from "../../../lib/discount";
import { formatDate, formatMoney } from "../../../lib/format";
import { HEALTH_LABEL, healthOf, type Health } from "../../../lib/health";
import type { QuoteSummary } from "../../../lib/types";

const STATUSES = ["draft", "submitted", "approved", "rejected"];
type SortKey = "customer" | "total" | "created";

export default function QuoteList() {
  const router = useRouter();
  const [items, setItems] = useState<QuoteSummary[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [approvalOnly, setApprovalOnly] = useState(false);
  const [health, setHealth] = useState<Health | "">("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Links from the dashboard look like /quotes?status=approved or /quotes?health=approval
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatus(p.get("status") ?? "");
    setHealth((p.get("health") as Health) ?? "");
  }, []);

  useEffect(() => {
    listQuotes(status, q).then(setItems).catch((e) => setError(toErrors(e)[0].message));
  }, [status, q]);

  async function exportAll() {
    try {
      await download("/api/quotes/export.csv", "quotes.csv");
      toast("Download started", "quotes.csv was saved to your downloads folder.");
    } catch (e) {
      toast("Download failed", toErrors(e)[0].message, "error");
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const sortBy = (key: SortKey) => setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });

  // Extra filters + sorting run in the browser on the list the API returned.
  const shown = (items ?? [])
    .filter((x) => (!approvalOnly || x.approval_required) && (!health || healthOf(x) === health))
    .sort((a, b) => {
      const va = sort.key === "customer" ? a.customer_name.toLowerCase() : sort.key === "total" ? a.total_cents : a.created_at;
      const vb = sort.key === "customer" ? b.customer_name.toLowerCase() : sort.key === "total" ? b.total_cents : b.created_at;
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
    });
  const filtering = !!(status || q || approvalOnly || health);
  const arrow = (k: SortKey) => (sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : "");
  const th = (k: SortKey, label: string, cls = "") => (
    <th className={cls} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="th-btn" onClick={() => sortBy(k)}>{label}{arrow(k)}</button>
    </th>
  );

  return (
    <section className="card">
      <h2>Saved quotes</h2>
      <div className="filters no-print">
        <input type="search" aria-label="Search customer or quote ID" placeholder="Search customer or quote ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by status">
          <button className={status === "" ? "chip on" : "chip"} aria-pressed={status === ""} onClick={() => setStatus("")}>All</button>
          {STATUSES.map((s) => <button key={s} className={status === s ? "chip on" : "chip"} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
        <button className={approvalOnly ? "chip on" : "chip"} aria-pressed={approvalOnly} onClick={() => setApprovalOnly(!approvalOnly)}>Approval required</button>
        {health && <button className="chip on" onClick={() => setHealth("")}>Health: {HEALTH_LABEL[health]} ✕</button>}
      </div>
      <div className="row no-print">
        <span>
          <button onClick={exportAll}>Export CSV</button>{" "}
          <button onClick={() => window.print()}>Print list</button>
        </span>
      </div>
      <div className="compare-bar no-print" role="status">
        <span><b>Compare scenarios:</b> tick two quotes in the table below ({picked.length} of 2 selected).</span>
        {picked.length === 2
          ? <Link className="btn primary" href={`/compare?a=${picked[0]}&b=${picked[1]}`}>Compare selected</Link>
          : <button className="primary" disabled>Compare selected</button>}
      </div>
      {error && <ErrorCard message={error} />}
      {!items && !error && <Skeleton rows={5} />}
      {items && shown.length === 0 && (filtering
        ? <EmptyState title="No quotes match these filters." text="Try a different search or clear a filter." />
        : <EmptyState title="No saved quotes yet." text="Create your first quote to start building your deal pipeline." cta />)}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="clickable">
            <thead><tr><th className="sel-col">Compare</th><th>ID</th>{th("customer", "Customer")}<th>Seats</th><th>Requested</th><th>Proposed</th><th>Approved</th>{th("total", "Total", "num")}<th>Approval</th><th>Status</th>{th("created", "Created")}</tr></thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id} className={picked.includes(x.id) ? "picked" : ""} onClick={() => router.push(`/quotes/${x.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.includes(x.id)} onChange={() => toggle(x.id)} aria-label={`Select ${x.id}`} /></td>
                  <td><Link href={`/quotes/${x.id}`} onClick={(e) => e.stopPropagation()}>{x.id}</Link></td>
                  <td>{x.customer_name}</td><td>{x.seats} ({x.tier})</td>
                  <td>{fmtPct(x.customer_requested_discount_pct)}</td><td>{fmtPct(x.proposed_discount_pct)}</td>
                  <td>{approvedLabel(x.approved_discount_pct)}</td>
                  <td className="num">{x.final_total_cents !== null ? <>{formatMoney(x.final_total_cents)}<br /><small className="muted">final (proposed {formatMoney(x.total_cents)})</small></> : formatMoney(x.total_cents)}</td>
                  <td>{x.approval_required ? <span className="badge warn">Required</span> : "No"}</td>
                  <td><span className={`badge s-${x.status}`}>{x.status}</span></td>
                  <td>{formatDate(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
