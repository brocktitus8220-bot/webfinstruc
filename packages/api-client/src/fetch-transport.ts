import { ApiError } from "./errors";
import type { Transport } from "./types";

const toSearch = (query: Record<string, unknown> | undefined) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
};

/** HTTP transport for a real backend. Not used until the API exists. */
export function createFetchTransport(baseUrl: string, fetchImpl: typeof fetch = fetch): Transport {
  const base = baseUrl.replace(/\/$/, "");
  return async (req) => {
    const url = `${base}${req.path}${toSearch(req.query as Record<string, unknown> | undefined)}`;
    const init: RequestInit = {
      method: req.method,
      headers: { accept: "application/json", ...req.headers, ...(req.body !== undefined ? { "content-type": "application/json" } : {}) },
    };
    if (req.body !== undefined) init.body = JSON.stringify(req.body);
    if (req.signal) init.signal = req.signal;
    const res = await fetchImpl(url, init);
    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = (data as { message?: string } | null)?.message ?? res.statusText;
      throw new ApiError(message, res.status, req.endpoint, data);
    }
    return data;
  };
}
