"use client";
import { useId, useState } from "react";

/**
 * Small "i" button with an explanation.
 * Hover (CSS) and keyboard focus (CSS) show the text; click toggles it for touch screens (React state).
 * The text is always in the DOM and linked with aria-describedby, so screen readers can read it.
 */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="tip">
      <button type="button" className="tip-btn" aria-label="More information" aria-describedby={id} aria-expanded={open}
        onClick={() => setOpen(!open)} onBlur={() => setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>i</button>
      <span id={id} role="tooltip" className={open ? "tip-box show" : "tip-box"}>{text}</span>
    </span>
  );
}
