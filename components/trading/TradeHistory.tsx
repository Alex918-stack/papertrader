"use client";

import { usePortfolio } from "@/lib/PortfolioContext";

export default function TradeHistory() {
  const { transactions } = usePortfolio();

  if (transactions.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
        No trades yet. Place your first order to see it here.
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Trade History
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-neutral-500 text-left border-b border-neutral-800">
            <th className="pb-2">Type</th>
            <th className="pb-2">Symbol</th>
            <th className="pb-2">Shares</th>
            <th className="pb-2">Price</th>
            <th className="pb-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
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
              <td className="py-2 text-neutral-200">${t.price.toFixed(2)}</td>
              <td className="py-2 text-neutral-200">${t.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}