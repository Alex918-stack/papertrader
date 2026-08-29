"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/PortfolioContext";
import { Holding } from "@/types/portfolio";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

// One row per component (not inlined in the map) so each holding's Market
// Value / Gain-Loss can tween on its own via useAnimatedNumber - hooks
// can't be called per-iteration inside a .map() in the parent. Recomputes,
// and therefore animates, at the same moment PerformanceCard/
// PortfolioSnapshot/BenchmarkComparison already do: right after a trade
// executes and quotes refresh.
function HoldingRow({ holding, currentPrice }: { holding: Holding; currentPrice: number }) {
  const marketValue = currentPrice * holding.shares;
  const costBasis = holding.avgCost * holding.shares;
  const gainLoss = marketValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  const isPositive = gainLoss >= 0;

  const animatedMarketValue = useAnimatedNumber(marketValue);
  const animatedGainLoss = useAnimatedNumber(gainLoss);
  const animatedGainLossPercent = useAnimatedNumber(gainLossPercent);

  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50">
      <td className="py-2 font-medium text-neutral-900">{holding.symbol}</td>
      <td className="py-2 text-neutral-700">{holding.shares}</td>
      <td className="py-2 text-neutral-700">${formatMoney(holding.avgCost)}</td>
      <td className="py-2 text-neutral-700">${formatMoney(currentPrice)}</td>
      <td className="py-2 text-neutral-700">${formatMoney(animatedMarketValue)}</td>
      <td className={`py-2 font-medium ${isPositive ? "text-green-700" : "text-red-600"}`}>
        {isPositive ? "+$" : "-$"}
        {formatMoney(Math.abs(animatedGainLoss))} ({isPositive ? "+" : ""}
        {animatedGainLossPercent.toFixed(2)}%)
      </td>
    </tr>
  );
}

export default function HoldingsTable() {
  const { holdings, loading: portfolioLoading } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading, error } = useStockQuotes(symbols);

  // The tour anchor lives on every branch, not just the populated one -
  // otherwise arriving here while holdings are still fetching finds no
  // element and the tour silently skips this beat.
  if (portfolioLoading) {
    return (
      <Card id="tour-holdings-table" className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card id="tour-holdings-table" padding="detail" className="text-center space-y-3">
        <p className="text-sm text-neutral-500">
          Your holdings will appear here once you place a trade.
        </p>
        <Link href="/trading" className={buttonVariants()}>
          Go to Trading
        </Link>
      </Card>
    );
  }

  return (
    <Card id="tour-holdings-table">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        Current Holdings
      </h2>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">Couldn&apos;t load prices: {error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-400 text-left border-b border-neutral-200">
                <th className="pb-2">Symbol</th>
                <th className="pb-2">Shares</th>
                <th className="pb-2">Avg Cost</th>
                <th className="pb-2">Current Price</th>
                <th className="pb-2">Market Value</th>
                <th className="pb-2">Gain / Loss</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <HoldingRow
                  key={h.symbol}
                  holding={h}
                  currentPrice={quotes[h.symbol]?.price ?? h.avgCost}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}