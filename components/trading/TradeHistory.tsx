"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { formatMoney } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

export default function TradeHistory() {
  const { transactions, loading: portfolioLoading } = usePortfolio();
  const [symbolFilter, setSymbolFilter] = useState("ALL");

  const uniqueSymbols = useMemo(() => {
    const symbols = Array.from(new Set(transactions.map((t) => t.symbol)));
    return symbols.sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (symbolFilter === "ALL") return transactions;
    return transactions.filter((t) => t.symbol === symbolFilter);
  }, [transactions, symbolFilter]);

  if (portfolioLoading) {
    return (
      <Card className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card padding="detail" className="text-center space-y-3">
        <p className="text-sm text-neutral-500">
          Your trade history will appear here once you place a trade.
        </p>
        <Link href="/trading" className={buttonVariants()}>
          Go to Trading
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col max-h-[440px]">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-neutral-900">
          Trade History
        </h2>
        <select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="bg-neutral-100 text-neutral-700 text-sm rounded-md px-2 py-1 border border-transparent focus:outline-none focus:border-coral-400"
        >
          <option value="ALL">All stocks</option>
          {uniqueSymbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-y-auto thin-scrollbar flex-1" data-lenis-prevent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-400 text-left border-b border-neutral-200 sticky top-0 bg-white">
              <th className="pb-2">Type</th>
              <th className="pb-2">Symbol</th>
              <th className="pb-2">Shares</th>
              <th className="pb-2">Fill price</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const hasExecutionDetail = t.spreadCost !== null && t.slippageCost !== null;
              const executionCost = hasExecutionDetail
                ? t.spreadCost! + t.slippageCost!
                : null;

              return (
                <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td
                    className={`py-2 font-medium ${
                      t.type === "BUY" ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {t.type}
                  </td>
                  <td className="py-2 text-neutral-700">
                    <span className="inline-flex items-center gap-1">
                      {t.symbol}
                      {t.episodeHasThesis && t.episodeId && (
                        <Link
                          href={`/journal?episode=${t.episodeId}`}
                          title="This trade has a thesis - view it in your journal"
                          className="text-neutral-300 hover:text-coral-500"
                        >
                          <BookOpen size={12} />
                        </Link>
                      )}
                    </span>
                  </td>
                  <td className="py-2 text-neutral-700">{t.shares}</td>
                  <td className="py-2 text-neutral-700">
                    ${formatMoney(t.price)}
                  </td>
                  <td className="py-2 text-neutral-700">
                    ${formatMoney(t.total)}
                  </td>
                  <td className="py-2 text-neutral-500">
                    {hasExecutionDetail ? (
                      <span
                        title={`Est. spread: $${formatMoney(t.spreadCost!)} · Est. slippage: $${formatMoney(t.slippageCost!)}`}
                      >
                        ${formatMoney(executionCost!)}
                      </span>
                    ) : (
                      <span className="text-neutral-300" title="Recorded before execution-cost modeling shipped">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}