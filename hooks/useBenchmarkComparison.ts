"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { usePortfolioValue } from "@/hooks/usePortfolioValue";
import { STARTING_CASH } from "@/lib/constants";

type BenchmarkApiResponse =
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "insufficient_history"; benchmarkStartDate: string }
  | {
      status: "ok";
      benchmarkReturnPct: number;
      benchmarkStartDate: string;
      latestDate: string;
      startingCash: number;
    };

export type BenchmarkComparisonResult =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "insufficient_history" }
  | {
      status: "ok";
      yourReturnPct: number;
      benchmarkReturnPct: number;
      benchmarkStartDate: string;
    };

// Combines app/api/benchmark's server-computed SPY side with the
// client-known live portfolio value to produce "your return %" - the server
// route deliberately doesn't fetch live quotes for every holding itself
// (that's already this app's job everywhere else), so this is where the two
// halves meet.
export function useBenchmarkComparison(): BenchmarkComparisonResult {
  const { status: authStatus } = useAuth();
  const { totalValue, holdings, portfolioLoading, quotesLoading } = usePortfolioValue();
  // This caller wants "is the number fully settled" rather than the
  // per-field "..." treatment PortfolioSnapshot/PerformanceCard use - it
  // renders one combined percentage, not a shell with individually-loading
  // cells, so there's no useful state between "not ready" and "ready."
  const valueLoading = portfolioLoading || (holdings.length > 0 && quotesLoading);
  const [apiResult, setApiResult] = useState<BenchmarkApiResponse | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;
    let cancelled = false;

    async function load() {
      if (authStatus !== "authenticated") {
        setApiResult({ status: "signed_out" });
        return;
      }
      try {
        const res = await fetch("/api/benchmark");
        const data: BenchmarkApiResponse = res.ok
          ? await res.json()
          : { status: "unavailable" };
        if (!cancelled) setApiResult(data);
      } catch {
        if (!cancelled) setApiResult({ status: "unavailable" });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus === "loading" || apiResult === null) {
    return { status: "loading" };
  }

  if (apiResult.status !== "ok") {
    return apiResult.status === "insufficient_history"
      ? { status: "insufficient_history" }
      : apiResult;
  }

  if (valueLoading) {
    return { status: "loading" };
  }

  return {
    status: "ok",
    yourReturnPct: ((totalValue - STARTING_CASH) / STARTING_CASH) * 100,
    benchmarkReturnPct: apiResult.benchmarkReturnPct,
    benchmarkStartDate: apiResult.benchmarkStartDate,
  };
}
