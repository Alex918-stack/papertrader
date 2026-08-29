"use client";

import Link from "next/link";
import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { Skeleton } from "../ui/Skeleton";
import { formatMoney } from "@/lib/format";

export default function WatchlistCard() {
  const symbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        Watchlist
      </h2>

{loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">Couldn&apos;t load data: {error}</p>
      )}

      {!loading && !error && (
        <ul className="space-y-1">
          {WATCHED_STOCKS.map((stock) => {
            const quote = quotes[stock.symbol];
            return (
              <li key={stock.symbol}>
                <Link
                  href={`/stocks/${stock.symbol}`}
                  className="flex justify-between items-center text-sm py-1 px-2 -mx-2 rounded-md hover:bg-neutral-50 transition-colors"
                >
                  <div>
                    <span className="font-medium text-neutral-700">
                      {stock.symbol}
                    </span>
                    <span className="text-neutral-400 ml-2">
                      {stock.name}
                    </span>
                  </div>
                  <span className="text-neutral-900">
                    {quote ? `$${formatMoney(quote.price)}` : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}