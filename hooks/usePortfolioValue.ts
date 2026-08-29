"use client";

import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";

// Cash + holdings marked to market at live quotes - the one place this is
// computed. PortfolioSnapshot, PerformanceCard, and the benchmark
// comparison all read from here now instead of each computing it
// independently. That matters beyond the usual "don't repeat yourself":
// on the Portfolio page, PerformanceCard and BenchmarkComparison render
// adjacent to each other, so if two independent implementations of "what's
// my portfolio worth" ever drifted apart, the user would see two different
// numbers for their own money on the same screen - worse than a normal bug
// for an app whose whole pitch is honesty about the numbers it shows.
//
// portfolioLoading and quotesLoading are exposed separately, not merged
// into one flag, because callers use them for two different things:
// portfolioLoading gates whether to render a full skeleton, quotesLoading
// (combined with holdings.length > 0) gates whether to show "..." for just
// the numeric value while the rest of the card is already visible. A
// merged flag would force every caller to either lose that distinction or
// re-derive the pieces anyway - so the raw pieces are what's shared.
export function usePortfolioValue() {
  const { cash, holdings, loading: portfolioLoading } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading: quotesLoading } = useStockQuotes(symbols);

  const holdingsValue = holdings.reduce((sum, h) => {
    const price = quotes[h.symbol]?.price ?? h.avgCost;
    return sum + price * h.shares;
  }, 0);

  return {
    cash,
    holdings,
    holdingsValue,
    totalValue: cash + holdingsValue,
    portfolioLoading,
    quotesLoading,
  };
}
