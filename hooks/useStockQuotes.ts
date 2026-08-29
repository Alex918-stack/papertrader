"use client";

import { useState, useEffect } from "react";
import { fetchWithPendingRetry } from "@/lib/fetchMarketData";

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  /** USD, or null if unavailable (e.g. crypto, or a fetch failure) - see app/api/stocks/route.ts. */
  marketCap: number | null;
  /** "stale" means real data, just older than its freshness window - never presented as current without this. */
  status: "fresh" | "stale";
  asOf: string;
}

async function fetchQuote(symbol: string, signal: AbortSignal): Promise<StockQuote> {
  const data = (await fetchWithPendingRetry(`/api/stocks?symbol=${symbol}`, signal)) as {
    status: string;
    error?: string;
  };
  if (data.status === "unavailable") {
    throw new Error(data.error || `No data available for ${symbol}`);
  }
  return data as unknown as StockQuote;
}

export function useStockQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (symbols.length === 0) {
      return;
    }

    const controller = new AbortController();

    async function fetchAll() {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled(symbols.map((symbol) => fetchQuote(symbol, controller.signal)));

      if (controller.signal.aborted) return;

      const map: Record<string, StockQuote> = {};
      const failedSymbols: string[] = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          map[result.value.symbol] = result.value;
        } else {
          failedSymbols.push(symbols[i]);
        }
      });

      setQuotes(map);
      if (failedSymbols.length > 0) {
        setError(`Couldn't load: ${failedSymbols.join(", ")}`);
      }
      setLoading(false);
    }

    fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return { quotes, loading: symbols.length === 0 ? false : loading, error };
}
