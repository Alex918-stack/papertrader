// Shared client-side fetch for /api/stocks: retries a "pending" response
// (a claim is held, nothing written yet - the cold-cache case, not an
// error) with a short bounded backoff instead of surfacing it as a
// failure. Returns the raw JSON as-is otherwise (including "unavailable" -
// each caller decides how to present that, e.g. StockChart falls back to
// local history, useStockQuotes treats it as a per-symbol failure), so
// this stays a plain fetch helper, not a policy about what "no data" means
// to a given consumer.
const PENDING_RETRY_DELAYS_MS = [400, 800, 1200];

export async function fetchWithPendingRetry(url: string, signal?: AbortSignal): Promise<unknown> {
  for (const delay of [0, ...PENDING_RETRY_DELAYS_MS]) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data?.status === "pending") continue;
    return data;
  }
  throw new Error("Timed out waiting for data - try again shortly.");
}
