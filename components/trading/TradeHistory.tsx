"use client";

import { useState, useMemo } from "react";
import { usePortfolio } from "@/lib/PortfolioContext";

export default function TradeHistory() {
  const { transactions } = usePortfolio();
  const [symbolFilter, setSymbolFilter] = useState("ALL");

  const uniqueSymbols = useMemo(() => {
    const symbols = Array.from(new Set(transactions.map((t) => t.symbol)));
    return symbols.sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (symbolFilter === "ALL") return transactions;
    return transactions.filter((t) => t.symbol === symbolFilter);
  }, [transactions, symbolFilter]);

  if (transactions.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
        No trades yet. Place your first order to see it here.
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col max-h-[440px]">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-neutral-100">
          Trade History
        </h2>
        <select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="bg-neutral-800 text-neutral-200 text-sm rounded-md px-2 py-1 border border-neutral-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All stocks</option>
          {uniqueSymbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-y-auto thin-scrollbar flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 text-left border-b border-neutral-800 sticky top-0 bg-neutral-900">
              <th className="pb-2">Type</th>
              <th className="pb-2">Symbol</th>
              <th className="pb-2">Shares</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-neutral-800/50">
                <td
                  className={`py-2 font-medium ${
                    t.type === "BUY" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.type}
                </td>
                <td className="py-2 text-neutral-200">{t.symbol}</td>
                <td className="py-2 text-neutral-200">{t.shares}</td>
                <td className="py-2 text-neutral-200">
                  ${t.price.toFixed(2)}
                </td>
                <td className="py-2 text-neutral-200">
                  ${t.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}