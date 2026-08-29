"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ALL_ASSETS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import StockChart from "@/components/charts/StockChart";
import { formatMoney } from "@/lib/format";

export default function StockExplorer() {
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState(ALL_ASSETS[0].symbol);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { quotes, loading } = useStockQuotes([symbol]);
  const quote = quotes[symbol];
  const selectedStock = ALL_ASSETS.find((s) => s.symbol === symbol);

  const filteredStocks = useMemo(() => {
    if (!search.trim()) return ALL_ASSETS;
    const q = search.toLowerCase();
    return ALL_ASSETS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [search]);

  function selectStock(sym: string) {
    setSymbol(sym);
    setSearch("");
    setPickerOpen(false);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">
        Explore a Stock
      </h2>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="w-full sm:w-72 flex justify-between items-center bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 border border-transparent hover:border-neutral-300"
        >
          <span>
            {selectedStock
              ? `${selectedStock.symbol} - ${selectedStock.name}`
              : "Select a stock"}
          </span>
          {pickerOpen ? (
            <ChevronUp size={18} className="text-neutral-400 flex-shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-neutral-400 flex-shrink-0" />
          )}
        </button>

        {pickerOpen && (
          <div className="dropdown-enter absolute z-20 mt-1 w-full sm:w-72 bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden">
            <input
              type="text"
              autoFocus
              placeholder="Search by symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white text-neutral-900 px-3 py-2 border-b border-neutral-200 focus:outline-none"
            />
            <div className="max-h-56 overflow-y-auto thin-scrollbar divide-y divide-neutral-100" data-lenis-prevent>
              {filteredStocks.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => selectStock(s.symbol)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    s.symbol === symbol
                      ? "bg-coral-50 text-coral-800"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-medium">{s.symbol}</span>
                  <span className="text-neutral-400 ml-2">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!loading && quote && (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-neutral-900">
            ${formatMoney(quote.price)}
          </span>
          <span
            className={`text-sm font-medium ${
              quote.change >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {quote.change >= 0 ? "+" : ""}
            {formatMoney(quote.change)} ({quote.change >= 0 ? "+" : ""}
            {quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      )}

      <StockChart symbol={symbol} />
    </div>
  );
}