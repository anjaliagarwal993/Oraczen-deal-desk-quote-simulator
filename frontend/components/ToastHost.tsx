"use client";
import { useEffect, useState } from "react";
import { takeFlash, type ToastDetail } from "../lib/toast";

interface Item extends ToastDetail { id: number }

export default function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let next = 0;
    const add = (d: ToastDetail) => {
      const id = ++next + Date.now();
      setItems((cur) => [...cur, { ...d, id }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
    };
    const onToast = (e: Event) => add((e as CustomEvent<ToastDetail>).detail);
    window.addEventListener("dealdesk:toast", onToast);
    const flash = takeFlash(); // e.g. the "Login successful" message set just before the redirect
    if (flash) add({ ...flash, kind: "success" });
    return () => window.removeEventListener("dealdesk:toast", onToast);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status">
          <span className="ti">{t.kind === "error" ? "!" : "✓"}</span>
          <div><b>{t.title}</b><span className="tm">{t.message}</span></div>
          <button aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}>✕</button>
        </div>
      ))}
    </div>
  );
}
