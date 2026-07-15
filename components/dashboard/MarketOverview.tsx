"use client";

import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export default function MarketOverview() {
  const symbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Market Overview
      </h2>

      {loading && (
        <p className="text-sm text-neutral-500">Loading market data...</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Couldn't load market data: {error}
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {WATCHED_STOCKS.map((stock) => {
            const quote = quotes[stock.symbol];
            if (!quote) return null;
            const isPositive = quote.change >= 0;

            return (
              <div key={stock.symbol} className="bg-neutral-800 rounded-md p-3">
                <p className="text-sm font-medium text-neutral-200">
                  {stock.symbol}
                </p>
                <p className="text-lg font-bold text-neutral-100">
                  ${quote.price.toFixed(2)}
                </p>
                <p
                  className={`text-xs font-medium ${
                    isPositive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {quote.change.toFixed(2)} ({isPositive ? "+" : ""}
                  {quote.changePercent.toFixed(2)}%)
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}