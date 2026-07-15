"use client";

import { useState } from "react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export default function OrderTicket() {
  const { buy, sell, cash } = usePortfolio();
  const [symbol, setSymbol] = useState(WATCHED_STOCKS[0].symbol);
  const [shares, setShares] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSymbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(allSymbols);

  const currentPrice = quotes[symbol]?.price ?? 0;
  const estimatedTotal = currentPrice * shares;

  function handleTrade(type: "BUY" | "SELL") {
    if (!currentPrice) {
      setFeedback("Price not loaded yet — try again in a moment.");
      return;
    }
    const result =
      type === "BUY"
        ? buy(symbol, shares, currentPrice)
        : sell(symbol, shares, currentPrice);
    setFeedback(result.message);
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-100">Place an Order</h2>

      <div className="text-sm text-neutral-400">
        Available cash:{" "}
        <span className="text-emerald-400">${cash.toFixed(2)}</span>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading prices...</p>}
      {error && (
        <p className="text-sm text-red-400">Couldn't load prices: {error}</p>
      )}

      <div>
        <label className="block text-sm text-neutral-400 mb-1">Stock</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full bg-neutral-800 text-neutral-100 rounded-md px-3 py-2 border border-neutral-700"
        >
          {WATCHED_STOCKS.map((s) => {
            const quote = quotes[s.symbol];
            return (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name}
                {quote ? ` ($${quote.price.toFixed(2)})` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label className="block text-sm text-neutral-400 mb-1">Shares</label>
        <input
          type="number"
          min={1}
          value={shares}
          onChange={(e) => setShares(Number(e.target.value))}
          className="w-full bg-neutral-800 text-neutral-100 rounded-md px-3 py-2 border border-neutral-700"
        />
      </div>

      <div className="text-sm text-neutral-400">
        Estimated total:{" "}
        <span className="text-neutral-100">${estimatedTotal.toFixed(2)}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleTrade("BUY")}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition-colors"
        >
          Buy
        </button>
        <button
          onClick={() => handleTrade("SELL")}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-md transition-colors"
        >
          Sell
        </button>
      </div>

      {feedback && (
        <p className="text-sm text-neutral-300 bg-neutral-800 rounded-md px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
}