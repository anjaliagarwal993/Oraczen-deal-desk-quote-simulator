"use client";
import { useState } from "react";
import type { Resolution } from "../lib/types";

/** Deal Coach tips from the API (rule-based, deterministic). Collapse/expand = one boolean in React state. */
export default function DealIntelligence({ coach, resolutions }: { coach: string[]; resolutions?: Resolution[] }) {
  const [open, setOpen] = useState(true);
  if (coach.length === 0) return null;
  const best = resolutions?.find((r) => r.removes_approval);
  return (
    <div className="intel no-print">
      <button className="intel-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>✦ DEAL INTELLIGENCE <small className="muted">(Deal Coach)</small></span><span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="intel-body">
          <ul>{coach.map((c) => <li key={c}>{c}</li>)}</ul>
          {best && (
            <div className="intel-action">
              <small>Recommended action</small>
              <b>{best.title}</b>
              <a href="#approval-resolution">Preview change →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
