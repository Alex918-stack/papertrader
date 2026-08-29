"use client";

import { PieChart } from "lucide-react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { formatMoney } from "@/lib/format";
import Card from "@/components/ui/Card";

// Deliberately present-tense only, computed client-side from live holdings
// + quotes - the same shape of number usePortfolioValue already computes
// for every other current-value display in this app, just kept per-symbol
// here instead of summed. See lib/decisionScorecard.ts's comment on why
// concentration has no honest server-side history equivalent.
//
// No minimum-data gate: a single holding being 100% concentrated is a true
// fact worth stating plainly, not something to hide behind a "not enough
// data yet" wall the way a sampled rate would need to be.
export default function ConcentrationCard() {
  const { cash, holdings, loading: portfolioLoading } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { quotes, loading: quotesLoading } = useStockQuotes(symbols);

  const rows = holdings
    .map((h) => ({
      symbol: h.symbol,
      value: (quotes[h.symbol]?.price ?? h.avgCost) * h.shares,
    }))
    .sort((a, b) => b.value - a.value);

  const totalValue = cash + rows.reduce((sum, r) => sum + r.value, 0);
  const loading = portfolioLoading || (holdings.length > 0 && quotesLoading);

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2 text-neutral-500">
        <PieChart size={16} className="flex-shrink-0" />
        <h3 className="text-sm font-medium">Concentration</h3>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading current holdings…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing currently held.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
            return (
              <div key={r.symbol} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-900">{r.symbol}</span>
                  <span className="num text-neutral-500">
                    {pct.toFixed(1)}% · ${formatMoney(r.value)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-seafoam-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
