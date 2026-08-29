"use client";

import { useState, useEffect } from "react";
import { fetchWithPendingRetry } from "@/lib/fetchMarketData";

// Trailing ~20-day average dollar volume for a symbol, sourced from the same
// candles endpoint StockChart already calls (type=candles, shared Postgres
// cache - see lib/marketDataCache.ts) - just reading the avgDollarVolume20d
// field that endpoint now also returns, not a new data dependency. Used by
// OrderTicket for the pre-commit pricing preview; PortfolioContext.trade()
// fetches this itself via lib/executionPricing.ts's fetchSymbolLiquidity for
// the actual execution, since it has no hook state to read from.
export function useAvgDollarVolume(symbol: string): number | null {
  const [avgDollarVolume20d, setAvgDollarVolume20d] = useState<number | null>(null);

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();

    async function load() {
      setAvgDollarVolume20d(null);
      try {
        const data = (await fetchWithPendingRetry(
          `/api/stocks?symbol=${encodeURIComponent(symbol)}&type=candles&days=30`,
          controller.signal
        )) as { avgDollarVolume20d?: number };
        if (controller.signal.aborted) return;
        setAvgDollarVolume20d(typeof data.avgDollarVolume20d === "number" ? data.avgDollarVolume20d : null);
      } catch {
        if (!controller.signal.aborted) setAvgDollarVolume20d(null);
      }
    }

    load();

    return () => {
      controller.abort();
    };
  }, [symbol]);

  return avgDollarVolume20d;
}
