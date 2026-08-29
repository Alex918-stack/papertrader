"use client";

import { usePortfolioValue } from "@/hooks/usePortfolioValue";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { formatMoney } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";

export default function PerformanceCard() {
  const { cash, holdings, holdingsValue, totalValue, portfolioLoading, quotesLoading } =
    usePortfolioValue();

  // Cost basis is a different question from current value - what was paid,
  // not what it's worth now - so it doesn't come from the shared hook (it
  // has no live-quote dependency at all) even though it's computed from the
  // same holdings array the hook already exposes.
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0);
  const totalGainLoss = holdingsValue - totalCostBasis;
  const gainLossPercent =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  const animatedTotalValue = useAnimatedNumber(totalValue);
  const animatedCash = useAnimatedNumber(cash);
  const animatedGainLoss = useAnimatedNumber(totalGainLoss);
  const animatedGainLossPercent = useAnimatedNumber(gainLossPercent);
  const isPositive = animatedGainLoss >= 0;

  if (portfolioLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <p className="text-sm text-neutral-400">Total Value</p>
        <p className="num text-2xl font-bold text-neutral-900">
          {holdings.length > 0 && quotesLoading
            ? "..."
            : `$${formatMoney(animatedTotalValue)}`}
        </p>
      </Card>

      <Card>
        <p className="text-sm text-neutral-400">Cash Available</p>
        <p className="num text-2xl font-bold text-neutral-900">
          ${formatMoney(animatedCash)}
        </p>
      </Card>

      <Card>
        <p className="text-sm text-neutral-400">Total Gain / Loss</p>
        <p
          className={`num text-2xl font-bold ${
            isPositive ? "text-green-700" : "text-red-600"
          }`}
        >
          {holdings.length > 0 && quotesLoading ? (
            "..."
          ) : (
            <>
              {isPositive ? "+$" : "-$"}
              {formatMoney(Math.abs(animatedGainLoss))} ({isPositive ? "+" : ""}
              {animatedGainLossPercent.toFixed(2)}%)
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
