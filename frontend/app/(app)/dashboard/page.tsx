"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorCard, Skeleton } from "../../../components/StateCards";
import { getStats, toErrors } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import { HEALTH_LABEL, healthCounts, type Health } from "../../../lib/health";
import type { Stats, Status } from "../../../lib/types";

const ORDER: Status[] = ["draft", "submitted", "approved", "rejected"];
const HEALTH_ORDER: Health[] = ["healthy", "review", "approval"];

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getStats().then(setS).catch((e) => setError(toErrors(e)[0].message)); }, []);
  if (error) return <ErrorCard message={error} />;
  if (!s) return <Skeleton rows={4} />;

  const open = s.value_by_status_cents.draft + s.value_by_status_cents.submitted;
  const openCount = s.by_status.draft + s.by_status.submitted;
  const health = healthCounts(s);
  return (
    <div>
      <div className="hero">
        <div>
          <h1>Deal Desk Overview</h1>
          <p>Monitor quote activity, pipeline value, and deals waiting for approval.</p>
        </div>
        <Link className="btn primary cta" href="/builder">+ Create New Quote</Link>
      </div>

      {/* Each card is a link: hover = CSS, click = go to the filtered quote list */}
      <div className="stats">
        <Link className="stat" href="/quotes"><small>◈ QUOTES</small><b>{s.count}</b><span className="muted">all saved quotes</span><em>View quotes →</em></Link>
        <Link className="stat" href="/quotes"><small>◇ OPEN PIPELINE</small><b>{formatMoney(open)}</b><span className="muted">{openCount} draft or submitted</span><em>View pipeline →</em></Link>
        <Link className="stat" href="/quotes?status=approved"><small>✓ APPROVED VALUE</small><b>{formatMoney(s.value_by_status_cents.approved)}</b><span className="muted">{s.by_status.approved} approved</span><em>View approved →</em></Link>
        <Link className="stat warn" href="/quotes?health=approval"><small>⚠ WAITING FOR APPROVAL</small><b>{s.needs_approval}</b><span className="muted">open quotes that need a manager</span><em>Review →</em></Link>
      </div>

      <div className="grid">
        <section className="card">
          <h3>Deal health</h3>
          <p className="muted small">Healthy = approved, or open with no approval needed. Needs review = rejected. Approval required = open and above policy.</p>
          <ul className="health-list">
            {HEALTH_ORDER.map((h) => (
              <li key={h}><Link href={`/quotes?health=${h}`} className={`health-row h-${h}`}>
                <span><i className={`dot h-${h}`} /> {HEALTH_LABEL[h]}</span><b>{health[h]}</b>
              </Link></li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Quotes by status</h3>
          <div className="stack" role="img" aria-label="Quotes by status">
            {ORDER.map((k) => s.by_status[k] > 0 && <div key={k} className={`seg s-${k}`} style={{ flex: s.by_status[k] }} />)}
          </div>
          <div className="legend">
            {ORDER.map((k) => <Link key={k} href={`/quotes?status=${k}`}><i className={`dot s-${k}`} /> {k} <b>{s.by_status[k]}</b></Link>)}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="row"><h3>Recent quotes</h3><Link href="/quotes">View all</Link></div>
        {s.recent.length === 0 && <EmptyState title="No saved quotes yet." text="Create your first quote to start building your deal pipeline." cta />}
        {s.recent.map((q) => (
          <Link key={q.id} href={`/quotes/${q.id}`} className="recent">
            <span><b>{q.customer_name}</b> <span className="muted">{q.id} · {q.seats} seats</span></span>
            <span>{formatMoney(q.total_cents)} <span className={`badge s-${q.status}`}>{q.status}</span></span>
          </Link>
        ))}
      </section>
    </div>
  );
}
