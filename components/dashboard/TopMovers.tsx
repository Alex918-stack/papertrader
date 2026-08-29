"use client";

import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TopMovers() {
  const symbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">
          Top Movers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">
          Top Movers
        </h2>
        <p className="text-sm text-red-600">Couldn&apos;t load data: {error}</p>
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
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        Top Movers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-neutral-400 mb-2">Top Gainers</p>
          <ul className="space-y-1">
            {topGainers.map((s) => (
              <li key={s.symbol} className="flex justify-between text-sm">
                <span className="text-neutral-700">{s.symbol}</span>
                <span className="text-green-700">
                  {s.changePercent >= 0 ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-neutral-400 mb-2">Top Losers</p>
          <ul className="space-y-1">
            {topLosers.map((s) => (
              <li key={s.symbol} className="flex justify-between text-sm">
                <span className="text-neutral-700">{s.symbol}</span>
                <span className={s.changePercent >= 0 ? "text-green-700" : "text-red-600"}>
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