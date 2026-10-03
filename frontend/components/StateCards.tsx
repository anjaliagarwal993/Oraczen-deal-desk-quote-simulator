import Link from "next/link";

/** Clear error card: what happened + what the user can do. The raw message stays visible for debugging. */
export function ErrorCard({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="state-card state-error" role="alert">
      <b>Something went wrong</b>
      <p>{message}</p>
      <p className="muted">{hint ?? "Check that the backend is running, then refresh the page."}</p>
    </div>
  );
}

export function EmptyState({ title, text, cta }: { title: string; text: string; cta?: boolean }) {
  return (
    <div className="state-card empty">
      <b>{title}</b>
      <p className="muted">{text}</p>
      {cta && <Link className="btn primary" href="/builder">+ Create quote</Link>}
    </div>
  );
}

/** Grey pulsing blocks shown while data loads (pure CSS animation). */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}
