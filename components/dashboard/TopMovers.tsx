"use client";

import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export default function TopMovers() {
  const symbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">
          Top Movers
        </h2>
        <p className="text-sm text-neutral-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">
          Top Movers
        </h2>
        <p className="text-sm text-red-400">Couldn't load data: {error}</p>
      </div>
    );
  }

  const available = Object.values(quotes);
  const sorted = [...available].sort(
    (a, b) => b.changePercent - a.changePercent
  );
  const topGainers = sorted.slice(0, 3);
  const topLosers = sorted.slice(-3).reverse();

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Top Movers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-neutral-500 mb-2">Top Gainers</p>
          <ul className="space-y-1">
            {topGainers.map((s) => (
              <li key={s.symbol} className="flex justify-between text-sm">
                <span className="text-neutral-200">{s.symbol}</span>
                <span className="text-emerald-400">
                  {s.changePercent >= 0 ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-2">Top Losers</p>
          <ul className="space-y-1">
            {topLosers.map((s) => (
              <li key={s.symbol} className="flex justify-between text-sm">
                <span className="text-neutral-200">{s.symbol}</span>
                <span className="text-red-400">
                  {s.changePercent >= 0 ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}