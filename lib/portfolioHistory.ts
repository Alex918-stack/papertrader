import { Transaction } from "@/types/portfolio";

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reconstructPortfolioHistory(
  transactions: Transaction[],
  startingCash: number
): Promise<PortfolioValuePoint[] | null> {
  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  const firstDateStr = new Date(sorted[0].timestamp).toISOString().split("T")[0];
  const daysSinceFirst =
    Math.ceil((Date.now() - sorted[0].timestamp) / (1000 * 60 * 60 * 24)) + 2;
  const days = Math.min(Math.max(daysSinceFirst, 2), 365);

  const symbols = Array.from(new Set(sorted.map((t) => t.symbol)));

  // Fetch sequentially, not in parallel, to avoid tripping the historical-data API's rate limit
  const priceMaps: Record<string, Record<string, number>> = {};
  for (const symbol of symbols) {
    try {
      const res = await fetch(
        `/api/stocks?symbol=${symbol}&type=candles&days=${days}`
      );
      if (res.ok) {
        const json = await res.json();
        const map: Record<string, number> = {};
        (json.points ?? []).forEach((p: { date: string; close: number }) => {
          map[p.date] = p.close;
        });
        priceMaps[symbol] = map;
      } else {
        priceMaps[symbol] = {};
      }
    } catch {
      priceMaps[symbol] = {};
    }
    await delay(1000);
  }

  const allDates = new Set<string>();
  Object.values(priceMaps).forEach((map) =>
    Object.keys(map).forEach((d) => allDates.add(d))
  );
  allDates.add(new Date().toISOString().split("T")[0]);

  const sortedDates = Array.from(allDates)
    .filter((d) => d >= firstDateStr)
    .sort();

  function closeAtOrBefore(symbol: string, date: string): number | null {
    const map = priceMaps[symbol];
    if (!map) return null;
    let best: string | null = null;
    for (const d of Object.keys(map)) {
      if (d <= date && (!best || d > best)) best = d;
    }
    return best ? map[best] : null;
  }

  // Fallback: last known transaction price for a symbol, in case its price history is missing entirely
  function lastKnownTradePrice(symbol: string, date: string): number | null {
    let best: Transaction | null = null;
    for (const t of sorted) {
      const tDate = new Date(t.timestamp).toISOString().split("T")[0];
      if (t.symbol !== symbol || tDate > date) continue;
      if (!best || t.timestamp > best.timestamp) best = t;
    }
    return best ? best.price : null;
  }

  const points: PortfolioValuePoint[] = [];

  for (const date of sortedDates) {
    let cash = startingCash;
    const shareCounts: Record<string, number> = {};

    for (const t of sorted) {
      const tDate = new Date(t.timestamp).toISOString().split("T")[0];
      if (tDate > date) break;

      if (t.type === "BUY") {
        cash -= t.total;
        shareCounts[t.symbol] = (shareCounts[t.symbol] ?? 0) + t.shares;
      } else {
        cash += t.total;
        shareCounts[t.symbol] = (shareCounts[t.symbol] ?? 0) - t.shares;
      }
    }

    let holdingsValue = 0;
    for (const [symbol, shares] of Object.entries(shareCounts)) {
      if (shares <= 0) continue;
      const price =
        closeAtOrBefore(symbol, date) ?? lastKnownTradePrice(symbol, date) ?? 0;
      holdingsValue += price * shares;
    }

    points.push({ date, value: cash + holdingsValue });
  }

  return points.length >= 2 ? points : null;
}