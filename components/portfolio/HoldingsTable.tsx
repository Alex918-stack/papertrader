"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { Skeleton } from "@/components/ui/Skeleton";

export default function HoldingsTable() {
  const { holdings } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  if (holdings.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 text-center space-y-3">
        <p className="text-sm text-neutral-500">
          You don't own any stocks yet. Head to the Trading page to place
          your first order.
        </p>
        <Link
          href="/trading"
          className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
        >
          Go to Trading
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Current Holdings
      </h2>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400">Couldn't load prices: {error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-500 text-left border-b border-neutral-800">
                <th className="pb-2">Symbol</th>
                <th className="pb-2">Shares</th>
                <th className="pb-2">Avg Cost</th>
                <th className="pb-2">Current Price</th>
                <th className="pb-2">Market Value</th>
                <th className="pb-2">Gain / Loss</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const currentPrice = quotes[h.symbol]?.price ?? h.avgCost;
                const marketValue = currentPrice * h.shares;
                const costBasis = h.avgCost * h.shares;
                const gainLoss = marketValue - costBasis;
                const gainLossPercent =
                  costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
                const isPositive = gainLoss >= 0;

                return (
                  <tr key={h.symbol} className="border-b border-neutral-800/50">
                    <td className="py-2 font-medium text-neutral-200">
                      {h.symbol}
                    </td>
                    <td className="py-2 text-neutral-200">{h.shares}</td>
                    <td className="py-2 text-neutral-200">
                      ${h.avgCost.toFixed(2)}
                    </td>
                    <td className="py-2 text-neutral-200">
                      ${currentPrice.toFixed(2)}
                    </td>
                    <td className="py-2 text-neutral-200">
                      ${marketValue.toFixed(2)}
                    </td>
                    <td
                      className={`py-2 font-medium ${
                        isPositive ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {isPositive ? "+$" : "-$"}
                      {Math.abs(gainLoss).toFixed(2)} ({isPositive ? "+" : ""}
                      {gainLossPercent.toFixed(2)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}