"use client";

import { useState, useEffect } from "react";

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function useStockQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      if (symbols.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
          const res = await fetch(`/api/stocks?symbol=${symbol}`);
          if (!res.ok) throw new Error(`Failed to fetch ${symbol}`);
          return (await res.json()) as StockQuote;
        })
      );

      if (cancelled) return;

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
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return { quotes, loading, error };
}