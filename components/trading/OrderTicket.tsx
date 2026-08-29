"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePortfolio, TradeThesis } from "@/lib/PortfolioContext";
import { ALL_ASSETS } from "@/lib/stockSymbols";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useAvgDollarVolume } from "@/hooks/useAvgDollarVolume";
import { useOpenEpisodeId } from "@/hooks/useOpenEpisodeId";
import OrderConfirmModal from "@/components/trading/OrderConfirmModal";
import ThesisForm, { ThesisFormValues, EMPTY_THESIS_VALUES } from "@/components/trading/ThesisForm";
import { useToast } from "@/components/ui/ToastProvider";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { formatMoney, shareWord } from "@/lib/format";
import { useAuth } from "@/components/layout/AuthProvider";
import GuestNotice from "@/components/ui/GuestNotice";
import { computeExecutionPricing } from "@/lib/executionPricing";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface OrderTicketProps {
  onSymbolChange?: (symbol: string) => void;
}

export default function OrderTicket({ onSymbolChange }: OrderTicketProps) {
  const { buy, sell, cash, holdings } = usePortfolio();
  const { status } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState(ALL_ASSETS[0].symbol);
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
const [shares, setShares] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [thesis, setThesis] = useState<ThesisFormValues>(EMPTY_THESIS_VALUES);
  const [note, setNote] = useState("");

  // A thesis is about the symbol, not the session - stale text from a
  // previously-viewed stock shouldn't carry over when the symbol or action
  // changes underneath it. Reset during render rather than in an effect
  // (React's own recommended pattern for "adjust state when a prop
  // changes") - an effect-based reset would render once with the stale
  // values, then commit, then reset on a second render; this does it in
  // the same render the change is first seen.
  const [resetKey, setResetKey] = useState(`${symbol}:${action}`);
  const nextResetKey = `${symbol}:${action}`;
  if (resetKey !== nextResetKey) {
    setResetKey(nextResetKey);
    setThesis(EMPTY_THESIS_VALUES);
    setNote("");
  }

  const currentHolding = holdings.find((h) => h.symbol === symbol);
  const isOpeningBuy = action === "BUY" && !currentHolding;
  const openEpisodeId = useOpenEpisodeId(symbol);

  const { quotes, loading, error } = useStockQuotes([symbol]);
  const currentPrice = quotes[symbol]?.price ?? 0;
  const marketCap = quotes[symbol]?.marketCap ?? null;
  const avgDollarVolume20d = useAvgDollarVolume(symbol);
  const estimatedTotal = currentPrice * shares;
  const animatedCurrentPrice = useAnimatedNumber(currentPrice);
  const animatedEstimatedTotal = useAnimatedNumber(estimatedTotal);

  // Live preview only - the actual trade recomputes this fresh at the
  // moment of execution (PortfolioContext.trade()), via the same
  // computeExecutionPricing call. The two can differ slightly if the quote
  // or liquidity data moves between opening this modal and clicking
  // Confirm - that's real, not a bug, which is exactly why everything here
  // is labeled "Est."
  const pricingPreview = useMemo(() => {
    if (!(currentPrice > 0) || shares <= 0) return null;
    return computeExecutionPricing({
      quotedPrice: currentPrice,
      side: action,
      shares,
      liquidity: { marketCap, avgDollarVolume20d },
    });
  }, [currentPrice, shares, action, marketCap, avgDollarVolume20d]);

  const filteredStocks = useMemo(() => {
    if (!search.trim()) return ALL_ASSETS;
    const q = search.toLowerCase();
    return ALL_ASSETS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedStock = ALL_ASSETS.find((s) => s.symbol === symbol);
  const isCrypto = selectedStock?.assetType === "crypto";

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

  function buildThesis(): TradeThesis | undefined {
    if (isOpeningBuy) {
      if (!thesis.whyThis.trim() && !thesis.whyNow.trim() && !thesis.invalidation.trim()) {
        return undefined; // nothing written - thesis is optional, so this is a normal, complete choice
      }
      const invalidationPrice = thesis.invalidationPrice.trim()
        ? Number(thesis.invalidationPrice)
        : undefined;
      return {
        whyThis: thesis.whyThis.trim(),
        whyNow: thesis.whyNow.trim(),
        invalidation: thesis.invalidation.trim(),
        invalidationPrice: Number.isFinite(invalidationPrice) ? invalidationPrice : undefined,
      };
    }
    return note.trim() ? { note: note.trim() } : undefined;
  }

async function handleConfirm() {
    setSubmitting(true);
    const thesisInput = buildThesis();
    const result =
      action === "BUY"
        ? await buy(symbol, shares, currentPrice, thesisInput)
        : await sell(symbol, shares, currentPrice, thesisInput);
    setSubmitting(false);
    if (result.success && result.closedEpisodeId) {
      showToast("Position closed — view it in your journal.", "success", `/journal?episode=${result.closedEpisodeId}`);
    } else {
      showToast(result.message, result.success ? "success" : "error");
    }
    if (result.success) setConfirmOpen(false);
  }

  return (
    <Card id="tour-order-ticket" className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">Place an Order</h2>

      {status !== "authenticated" && <GuestNotice />}

      <div className="text-sm text-neutral-500">
        Available cash:{" "}
        <span className="text-seafoam-700 font-medium">${formatMoney(cash)}</span>
      </div>

      <div className="relative">
        <label className="block text-sm text-neutral-500 mb-1">Symbol</label>

        <button
          id="tour-symbol-picker"
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="w-full flex justify-between items-center bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 border border-transparent hover:border-neutral-300"
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
          <div className="dropdown-enter absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden">
            <input
              type="text"
              autoFocus
              placeholder="Search by symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white text-neutral-900 px-3 py-2 border-b border-neutral-200 focus:outline-none"
            />
            <div className="max-h-56 overflow-y-auto thin-scrollbar divide-y divide-neutral-100" data-lenis-prevent>
              {filteredStocks.length === 0 && (
                <p className="text-sm text-neutral-400 px-3 py-3">
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
                      ? "bg-coral-50 text-coral-800"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span>
                    <span className="font-medium">{s.symbol}</span>
                    <span className="text-neutral-400 ml-2">{s.name}</span>
                  </span>
                  {s.symbol === symbol && (
                    <span className="text-coral-800 text-xs">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-400">Loading price...</p>}
      {error && (
        <p className="text-sm text-red-600">Couldn&apos;t load price: {error}</p>
      )}
      {!loading && !error && currentPrice > 0 && (
        <div className="text-sm text-neutral-500">
          Current price:{" "}
          <span className="num text-neutral-900">${formatMoney(animatedCurrentPrice)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-neutral-500 mb-1">Action</label>
          <select
            id="tour-action-select"
            value={action}
            onChange={(e) => setAction(e.target.value as "BUY" | "SELL")}
            className="w-full bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 border border-transparent"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-neutral-500 mb-1">
            {isCrypto ? "Quantity" : "Shares"}
          </label>
          <input
            id="tour-shares-input"
            type="number"
            min={isCrypto ? 0.0001 : 1}
            step={isCrypto ? "any" : 1}
            value={shares}
            onChange={(e) => setShares(Number(e.target.value))}
            className="w-full bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 border border-transparent"
          />
        </div>
      </div>

      {isOpeningBuy ? (
        <div id="tour-thesis-form" className="space-y-1.5">
          <p className="text-xs text-neutral-500">
            You&apos;re opening a new position in {symbol}.
          </p>
          <ThesisForm
            value={thesis}
            onChange={setThesis}
            isGuest={status !== "authenticated"}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {currentHolding && (
            <p className="text-xs text-neutral-500">
              You {action === "BUY" ? "already hold" : "hold"} {currentHolding.shares}{" "}
              {isCrypto ? "" : `${shareWord(currentHolding.shares)} of `}
              {symbol} — no new thesis needed
              {/* "already journaled" is only true for a signed-in user - nothing
                  persists for guests, so there's nothing journaled to point at. */}
              {openEpisodeId ? (
                <>
                  , this position&apos;s already journaled.{" "}
                  <Link
                    href={`/journal?episode=${openEpisodeId}`}
                    className="text-coral-600 hover:underline underline-offset-2"
                  >
                    View it
                  </Link>
                  .
                </>
              ) : (
                "."
              )}
            </p>
          )}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              {action === "BUY" ? "Why add more? (optional)" : "Why sell now? (optional)"}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-neutral-100 text-neutral-900 text-sm rounded-md px-3 py-2 border border-transparent focus:outline-none focus:border-coral-400 resize-none"
            />
          </div>
        </div>
      )}

      <div className="text-sm text-neutral-500">
        Estimated total:{" "}
        <span className="num text-neutral-900">${formatMoney(animatedEstimatedTotal)}</span>
      </div>

      <Button
        onClick={handlePreview}
        variant={action === "BUY" ? "buy" : "sell"}
        fullWidth
      >
        Preview {action === "BUY" ? "Buy" : "Sell"} Order
      </Button>

<OrderConfirmModal
        isOpen={confirmOpen}
        action={action}
        symbol={symbol}
        companyName={selectedStock?.name ?? ""}
        shares={shares}
        pricing={pricingPreview}
        isCrypto={isCrypto}
        submitting={submitting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}