"use client";

import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import { useStockQuotes, StockQuote } from "@/hooks/useStockQuotes";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { Skeleton } from "../ui/Skeleton";
import { formatMoney } from "@/lib/format";

function MarketQuoteTile({
  symbol,
  quote,
}: {
  symbol: string;
  quote: StockQuote;
}) {
  const isPositive = quote.change >= 0;
  const animatedPrice = useAnimatedNumber(quote.price);

  return (
    <div className="bg-neutral-50 hover:bg-neutral-100 transition-colors rounded-md p-3">
      <p className="text-sm font-medium text-neutral-500">{symbol}</p>
      <p className="num text-lg font-bold text-neutral-900">
        ${formatMoney(animatedPrice)}
      </p>
      <p
        className={`num text-xs font-medium ${
          isPositive ? "text-green-700" : "text-red-600"
        }`}
      >
        {isPositive ? "+" : ""}
        {formatMoney(quote.change)} ({isPositive ? "+" : ""}
        {quote.changePercent.toFixed(2)}%)
      </p>
    </div>
  );
}

export default function MarketOverview() {
  const symbols = WATCHED_STOCKS.map((s) => s.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        Market Overview
      </h2>

{loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-neutral-50 rounded-md p-3 space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load market data: {error}
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {WATCHED_STOCKS.map((stock) => {
            const quote = quotes[stock.symbol];
            if (!quote) return null;

            return (
              <MarketQuoteTile
                key={stock.symbol}
                symbol={stock.symbol}
                quote={quote}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}