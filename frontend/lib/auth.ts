import type { AuthSession, AuthUser } from "./types";

const TOKEN = "dealdesk.token";
const USER = "dealdesk.user";

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN); } catch { return null; }
};

export function getUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(USER) ?? "null") as AuthUser | null; } catch { return null; }
}

export function setSession(s: AuthSession): void {
  try { localStorage.setItem(TOKEN, s.token); localStorage.setItem(USER, JSON.stringify(s.user)); } catch { /* storage blocked */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); } catch { /* ignore */ }
}
