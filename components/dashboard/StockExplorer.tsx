"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ALL_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import StockChart from "@/components/charts/StockChart";

export default function StockExplorer() {
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState(ALL_STOCKS[0].symbol);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { quotes, loading } = useStockQuotes([symbol]);
  const quote = quotes[symbol];
  const selectedStock = ALL_STOCKS.find((s) => s.symbol === symbol);

  const filteredStocks = useMemo(() => {
    if (!search.trim()) return ALL_STOCKS;
    const q = search.toLowerCase();
    return ALL_STOCKS.filter(
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-100">
        Explore a Stock
      </h2>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="w-full sm:w-72 flex justify-between items-center bg-neutral-800 text-neutral-100 rounded-md px-3 py-2 border border-neutral-700 hover:border-neutral-600"
        >
          <span>
            {selectedStock
              ? `${selectedStock.symbol} - ${selectedStock.name}`
              : "Select a stock"}
          </span>
          {pickerOpen ? (
            <ChevronUp size={18} className="text-neutral-500 flex-shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-neutral-500 flex-shrink-0" />
          )}
        </button>

        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full sm:w-72 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg overflow-hidden">
            <input
              type="text"
              autoFocus
              placeholder="Search by symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-100 px-3 py-2 border-b border-neutral-700 focus:outline-none"
            />
            <div className="max-h-56 overflow-y-auto thin-scrollbar divide-y divide-neutral-800">
              {filteredStocks.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => selectStock(s.symbol)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    s.symbol === symbol
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  <span className="font-medium">{s.symbol}</span>
                  <span className="text-neutral-500 ml-2">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!loading && quote && (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-neutral-100">
            ${quote.price.toFixed(2)}
          </span>
          <span
            className={`text-sm font-medium ${
              quote.change >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {quote.change >= 0 ? "+" : ""}
            {quote.change.toFixed(2)} ({quote.change >= 0 ? "+" : ""}
            {quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      )}

      <StockChart symbol={symbol} />
    </div>
  );
}