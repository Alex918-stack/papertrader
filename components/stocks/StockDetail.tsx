"use client";

import Link from "next/link";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { WATCHED_STOCKS } from "@/lib/stockSymbols";

interface StockDetailProps {
  symbol: string;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const { quotes, loading, error } = useStockQuotes([symbol]);
  const quote = quotes[symbol];
  const stockInfo = WATCHED_STOCKS.find((s) => s.symbol === symbol);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ← Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{symbol}</h1>
        {stockInfo && (
          <p className="text-neutral-400">{stockInfo.name}</p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-neutral-500">Loading quote...</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Couldn't load data for {symbol}: {error}
        </p>
      )}

      {!loading && !error && quote && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-neutral-500">Current Price</p>
            <p className="text-4xl font-bold text-neutral-100">
              ${quote.price.toFixed(2)}
            </p>
            <p
              className={`text-sm font-medium mt-1 ${
                quote.change >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} ({quote.change >= 0 ? "+" : ""}
              {quote.changePercent.toFixed(2)}%) today
            </p>
          </div>

          <Link
            href="/trading"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-md transition-colors"
          >
            Trade {symbol}
          </Link>
        </div>
      )}
    </div>
  );
}