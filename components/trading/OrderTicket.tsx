"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { ALL_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import OrderConfirmModal from "@/components/trading/OrderConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

interface OrderTicketProps {
  onSymbolChange?: (symbol: string) => void;
}

export default function OrderTicket({ onSymbolChange }: OrderTicketProps) {
  const { buy, sell, cash } = usePortfolio();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState(ALL_STOCKS[0].symbol);
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
const [shares, setShares] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { quotes, loading, error } = useStockQuotes([symbol]);
  const currentPrice = quotes[symbol]?.price ?? 0;
  const estimatedTotal = currentPrice * shares;

  const filteredStocks = useMemo(() => {
    if (!search.trim()) return ALL_STOCKS;
    const q = search.toLowerCase();
    return ALL_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedStock = ALL_STOCKS.find((s) => s.symbol === symbol);

function selectStock(sym: string) {
    setSymbol(sym);
    setSearch("");
    setPickerOpen(false);
    onSymbolChange?.(sym);
  }

function handlePreview() {
    if (!currentPrice) {
      showToast("Price not loaded yet - try again in a moment.", "error");
      return;
    }
    if (shares <= 0) {
      showToast("Enter a valid number of shares.", "error");
      return;
    }
    setConfirmOpen(true);
  }

function handleConfirm() {
    const result =
      action === "BUY"
        ? buy(symbol, shares, currentPrice)
        : sell(symbol, shares, currentPrice);
    showToast(result.message, result.success ? "success" : "error");
    setConfirmOpen(false);
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-100">Place an Order</h2>

      <div className="text-sm text-neutral-400">
        Available cash:{" "}
        <span className="text-emerald-400">${cash.toFixed(2)}</span>
      </div>

      <div className="relative">
        <label className="block text-sm text-neutral-400 mb-1">Symbol</label>

        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="w-full flex justify-between items-center bg-neutral-800 text-neutral-100 rounded-md px-3 py-2 border border-neutral-700 hover:border-neutral-600"
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
          <div className="absolute z-20 mt-1 w-full bg-neutral-900 border border-neutral-700 rounded-md shadow-lg overflow-hidden">
            <input
              type="text"
              autoFocus
              placeholder="Search by symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-800 text-neutral-100 px-3 py-2 border-b border-neutral-700 focus:outline-none"
            />
            <div className="max-h-56 overflow-y-auto thin-scrollbar divide-y divide-neutral-800">
              {filteredStocks.length === 0 && (
                <p className="text-sm text-neutral-500 px-3 py-3">
                  No matches found
                </p>
              )}
              {filteredStocks.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => selectStock(s.symbol)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex justify-between items-center ${
                    s.symbol === symbol
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  <span>
                    <span className="font-medium">{s.symbol}</span>
                    <span className="text-neutral-500 ml-2">{s.name}</span>
                  </span>
                  {s.symbol === symbol && (
                    <span className="text-emerald-400 text-xs">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading price...</p>}
      {error && (
        <p className="text-sm text-red-400">Couldn't load price: {error}</p>
      )}
      {!loading && !error && currentPrice > 0 && (
        <div className="text-sm text-neutral-400">
          Current price:{" "}
          <span className="text-neutral-100">${currentPrice.toFixed(2)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as "BUY" | "SELL")}
            className="w-full bg-neutral-800 text-neutral-100 rounded-md px-3 py-2 border border-neutral-700"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
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
      </div>

      <div className="text-sm text-neutral-400">
        Estimated total:{" "}
        <span className="text-neutral-100">${estimatedTotal.toFixed(2)}</span>
      </div>

      <button
        onClick={handlePreview}
        className={`w-full font-medium py-2 rounded-md transition-colors text-white ${
          action === "BUY"
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "bg-red-600 hover:bg-red-500"
        }`}
      >
        Preview {action === "BUY" ? "Buy" : "Sell"} Order
      </button>

<OrderConfirmModal
        isOpen={confirmOpen}
        action={action}
        symbol={symbol}
        companyName={selectedStock?.name ?? ""}
        shares={shares}
        price={currentPrice}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}