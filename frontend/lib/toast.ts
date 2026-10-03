export type ToastKind = "success" | "error";
export interface ToastDetail { title: string; message: string; kind: ToastKind }

const FLASH = "dealdesk.flash";

/** Show a message in the corner of the screen (picked up by <ToastHost />). */
export function toast(title: string, message: string, kind: ToastKind = "success"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ToastDetail>("dealdesk:toast", { detail: { title, message, kind } }));
  }
}

/** A message that must survive a page change, e.g. "Login successful" shown on the dashboard. */
export function setFlash(title: string, message: string): void {
  try { sessionStorage.setItem(FLASH, JSON.stringify({ title, message })); } catch { /* ignore */ }
}

export function takeFlash(): { title: string; message: string } | null {
  try {
    const raw = sessionStorage.getItem(FLASH);
    sessionStorage.removeItem(FLASH);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
