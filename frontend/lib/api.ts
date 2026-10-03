import { clearSession, getToken } from "./auth";
import type { AuthSession, Stats, ApiErrorItem, CalcResponse, Catalog, Comparison, DraftInput, Quote, QuoteSummary, Status } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public errors: ApiErrorItem[]) {
    super(errors.map((e) => e.message).join(" "));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", headers, ...init });
  } catch {
    throw new ApiError(0, [{ code: "network", message: `Cannot reach the API at ${API_URL}. Is the backend running?` }]);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 && body?.errors?.[0]?.code === "unauthorized" && typeof window !== "undefined") {
    clearSession(); // expired or missing login: send the person to the login page
    window.location.href = "/login";
  }
  if (!res.ok) {
    throw new ApiError(res.status, body?.errors ?? [{ code: `http_${res.status}`, message: `Request failed (${res.status}).` }]);
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const getCatalog = () => request<Catalog>("/api/catalog");
export const calculate = (d: DraftInput) => request<CalcResponse>("/api/quotes/calculate", post(d));
export const createQuote = (d: DraftInput) => request<Quote>("/api/quotes", post(d));
export const getQuote = (id: string) => request<Quote>(`/api/quotes/${encodeURIComponent(id)}`);
export function listQuotes(status = "", q = "") {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  return request<QuoteSummary[]>(`/api/quotes?${params}`);
}
export const changeStatus = (id: string, status: Status, extra: { approved_discount_pct?: number; comment?: string } = {}) =>
  request<Quote>(`/api/quotes/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
export const compareQuotes = (a: string, b: string) =>
  request<Comparison>(`/api/quotes/compare?${new URLSearchParams({ a, b })}`);

export function toErrors(e: unknown): ApiErrorItem[] {
  return e instanceof ApiError ? e.errors : [{ code: "unknown", message: "Something went wrong." }];
}
export const getStats = () => request<Stats>("/api/stats");
export const register = (name: string, email: string, password: string) =>
  request<AuthSession>("/api/auth/register", post({ name, email, password }));
export const login = (email: string, password: string) =>
  request<AuthSession>("/api/auth/login", post({ email, password }));

/** Download a file from the API. A plain <a href> cannot send the login token, so we fetch it and save the blob. */
export async function download(path: string, filename: string): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, [{ code: "network", message: `Cannot reach the API at ${API_URL}. Is the backend running?` }]);
  }
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError(res.status, [{ code: "download_failed", message: "The file could not be downloaded. Please try again." }]);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
