"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import type {
  MetricGate,
  WinRateResult,
  AvgWinLossResult,
  ProfitFactorResult,
  HoldingPeriodResult,
  OverTradingCostResult,
  PositionSizingResult,
  VsSp500Aggregate,
  EpisodeVsSp500,
  ExitVsPlanAggregate,
  ExitVsPlanOutcome,
} from "@/lib/decisionScorecard";

export interface ScorecardData {
  headline: string;
  totalEpisodes: number;
  closedEpisodes: number;
  winRate: MetricGate<WinRateResult>;
  avgWinLoss: MetricGate<AvgWinLossResult>;
  profitFactor: MetricGate<ProfitFactorResult>;
  holdingPeriods: { winners: MetricGate<HoldingPeriodResult>; losers: MetricGate<HoldingPeriodResult> };
  overTradingCost: { dollars: OverTradingCostResult; percent: MetricGate<number> };
  positionSizing: MetricGate<PositionSizingResult>;
  vsSp500: { aggregate: MetricGate<VsSp500Aggregate>; perEpisode: EpisodeVsSp500[] };
  exitVsPlan: {
    aggregate: MetricGate<ExitVsPlanAggregate>;
    perEpisode: { episodeId: string; outcome: ExitVsPlanOutcome }[];
    eligible: number;
  };
}

type ApiResponse = { status: "signed_out" } | { status: "unavailable" } | ({ status: "ok" } & ScorecardData);

export type ScorecardResult =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "unavailable" }
  | ({ status: "ok" } & ScorecardData);

export function useDecisionScorecard(): ScorecardResult {
  const { status: authStatus } = useAuth();
  const [result, setResult] = useState<ApiResponse | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;
    let cancelled = false;

    async function load() {
      if (authStatus !== "authenticated") {
        setResult({ status: "signed_out" });
        return;
      }
      try {
        const res = await fetch("/api/journal/scorecard");
        const data: ApiResponse = res.ok ? await res.json() : { status: "unavailable" };
        if (!cancelled) setResult(data);
      } catch {
        if (!cancelled) setResult({ status: "unavailable" });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus === "loading" || result === null) return { status: "loading" };
  return result;
}
