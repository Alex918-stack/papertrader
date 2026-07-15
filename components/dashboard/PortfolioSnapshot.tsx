"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export default function PortfolioSnapshot() {
  const { cash, holdings } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading } = useStockQuotes(symbols);

  const holdingsValue = holdings.reduce((sum, h) => {
    const price = quotes[h.symbol]?.price ?? h.avgCost;
    return sum + price * h.shares;
  }, 0);
  const totalValue = cash + holdingsValue;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-neutral-100">
          Portfolio Snapshot
        </h2>
        <Link
          href="/portfolio"
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          View details →
        </Link>
      </div>
      <div className="flex justify-between text-sm">
        <div>
          <p className="text-neutral-500">Total Value</p>
          <p className="text-xl font-bold text-neutral-100">
            {holdings.length > 0 && loading
              ? "..."
              : `$${totalValue.toFixed(2)}`}
          </p>
        </div>
        <div>
          <p className="text-neutral-500">Cash</p>
          <p className="text-xl font-bold text-neutral-100">
            ${cash.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-neutral-500">Positions</p>
          <p className="text-xl font-bold text-neutral-100">
            {holdings.length}
          </p>
        </div>
      </div>
    </div>
  );
}