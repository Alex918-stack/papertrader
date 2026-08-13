"use client";

import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export default function PerformanceCard() {
  const { cash, holdings } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading } = useStockQuotes(symbols);

  const holdingsValue = holdings.reduce((sum, h) => {
    const price = quotes[h.symbol]?.price ?? h.avgCost;
    return sum + price * h.shares;
  }, 0);

  const totalCostBasis = holdings.reduce((sum, h) => {
    return sum + h.avgCost * h.shares;
  }, 0);

  const totalGainLoss = holdingsValue - totalCostBasis;
  const totalValue = cash + holdingsValue;
  const gainLossPercent =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const isPositive = totalGainLoss >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <p className="text-sm text-neutral-500">Total Value</p>
        <p className="text-2xl font-bold text-neutral-100">
          {holdings.length > 0 && loading
            ? "..."
            : `$${totalValue.toFixed(2)}`}
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <p className="text-sm text-neutral-500">Cash Available</p>
        <p className="text-2xl font-bold text-neutral-100">
          ${cash.toFixed(2)}
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <p className="text-sm text-neutral-500">Total Gain / Loss</p>
        <p
          className={`text-2xl font-bold ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}
        >
{holdings.length > 0 && loading ? (
            "..."
          ) : (
            <>
              {isPositive ? "+$" : "-$"}
              {Math.abs(totalGainLoss).toFixed(2)} ({isPositive ? "+" : ""}
              {gainLossPercent.toFixed(2)}%)
            </>
          )}
        </p>
      </div>
    </div>
  );
}