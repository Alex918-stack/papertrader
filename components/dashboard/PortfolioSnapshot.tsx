"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { recordPoint } from "@/lib/priceHistory";

export default function PortfolioSnapshot() {
  const { cash, holdings } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading } = useStockQuotes(symbols);

  const holdingsValue = holdings.reduce((sum, h) => {
    const price = quotes[h.symbol]?.price ?? h.avgCost;
    return sum + price * h.shares;
  }, 0);
  const totalValue = cash + holdingsValue;

  useEffect(() => {
    if (!loading) {
      recordPoint("portfolio-total", totalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalValue, loading]);

  return (
    <Link
      href="/portfolio"
      className="block bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:bg-neutral-950 hover:border-neutral-700 transition-colors cursor-pointer"
    >
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Portfolio Snapshot
      </h2>
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
    </Link>
  );
}