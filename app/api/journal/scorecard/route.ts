import { NextResponse } from "next/server";
import { createClient, getAuthedEmail } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBenchmarkPricesUpToDate } from "@/lib/benchmarkPrices";
import { ensureDailyPricesDeepCoverage } from "@/lib/marketDataCache";
import { fetchDailyPricesFromTwelveData } from "@/lib/marketDataProviders";
import { STARTING_CASH } from "@/lib/constants";
import {
  computeRateMetrics,
  computeHoldingPeriods,
  computeOverTradingCost,
  computePositionSizing,
  computeEpisodeVsSp500,
  aggregateVsSp500,
  computeExitVsPlan,
  aggregateExitVsPlan,
  buildHeadline,
  ScorecardEpisode,
  ScorecardTransaction,
  ExitVsPlanOutcome,
} from "@/lib/decisionScorecard";

// A single fetch (5000 daily bars) covers ~19 years of history for 1 Twelve
// Data credit - see lib/benchmarkPrices.ts, which established this same
// figure for SPY. Used only when a symbol's cached history doesn't already
// reach back far enough to cover a position episode's window - most
// symbols never need this, since anything a user has ever viewed a chart
// for is normally already cached well past this app's own lifetime.
const DEEP_OUTPUTSIZE = 5000;

export async function GET() {
  const email = await getAuthedEmail();
  if (!email) {
    return NextResponse.json({ status: "signed_out" });
  }

  const supabase = await createClient();

  const { data: episodeRows, error: episodeError } = await supabase
    .from("position_episodes")
    .select("id, symbol, opened_at, closed_at, thesis_invalidation_price, exit_reflection")
    .order("opened_at", { ascending: true });

  if (episodeError) {
    return NextResponse.json({ status: "unavailable" });
  }

  const { data: transactionRows, error: transactionError } = await supabase
    .from("transactions")
    .select("episode_id, type, shares, price, total, executed_at, quoted_price, spread_cost, slippage_cost")
    .order("executed_at", { ascending: true });

  if (transactionError) {
    return NextResponse.json({ status: "unavailable" });
  }

  const allTransactionsOrdered: ScorecardTransaction[] = (transactionRows ?? []).map((t) => ({
    type: t.type as "buy" | "sell",
    shares: Number(t.shares),
    price: Number(t.price),
    total: Number(t.total),
    executedAt: t.executed_at,
    quotedPrice: t.quoted_price === null ? null : Number(t.quoted_price),
    spreadCost: t.spread_cost === null ? null : Number(t.spread_cost),
    slippageCost: t.slippage_cost === null ? null : Number(t.slippage_cost),
  }));

  // Transactions with no episode_id predate episode tracking (0008) or
  // belong to a position that was already open before it shipped - they
  // simply have nothing to attach to, same "excluded, not miscounted"
  // stance as the rest of this feature.
  const transactionsByEpisode = new Map<string, ScorecardTransaction[]>();
  for (const t of transactionRows ?? []) {
    if (!t.episode_id) continue;
    const list = transactionsByEpisode.get(t.episode_id) ?? [];
    list.push({
      type: t.type as "buy" | "sell",
      shares: Number(t.shares),
      price: Number(t.price),
      total: Number(t.total),
      executedAt: t.executed_at,
      quotedPrice: t.quoted_price === null ? null : Number(t.quoted_price),
      spreadCost: t.spread_cost === null ? null : Number(t.spread_cost),
      slippageCost: t.slippage_cost === null ? null : Number(t.slippage_cost),
    });
    transactionsByEpisode.set(t.episode_id, list);
  }

  const episodes: ScorecardEpisode[] = (episodeRows ?? [])
    .map((row): ScorecardEpisode | null => {
      const transactions = transactionsByEpisode.get(row.id);
      if (!transactions || transactions.length === 0) return null; // nothing to compute against
      return {
        id: row.id,
        symbol: row.symbol,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        thesisInvalidationPrice: row.thesis_invalidation_price === null ? null : Number(row.thesis_invalidation_price),
        exitReflection: row.exit_reflection,
        transactions,
      };
    })
    .filter((e): e is ScorecardEpisode => e !== null);

  const closedEpisodes = episodes.filter((e) => e.closedAt !== null);

  const { winRate, avgWinLoss, profitFactor } = computeRateMetrics(episodes);
  const holdingPeriods = computeHoldingPeriods(episodes);
  const overTradingCost = computeOverTradingCost(episodes);
  const positionSizing = computePositionSizing(STARTING_CASH, allTransactionsOrdered, episodes);

  // ---- Performance vs. S&P 500, per closed episode --------------------
  // Best-effort refresh, same as app/api/benchmark/route.ts - a failed
  // refresh just means this falls through to whatever's already stored.
  try {
    await ensureBenchmarkPricesUpToDate();
  } catch {
    // Ignored on purpose.
  }

  const vsSp500PerEpisode = [];
  for (const episode of closedEpisodes) {
    const { data: startDate } = await supabase.rpc("benchmark_trading_date", { p_ts: episode.openedAt });
    const { data: endDate } = await supabase.rpc("benchmark_trading_date", { p_ts: episode.closedAt! });
    if (!startDate || !endDate) continue;

    const { data: startRow } = await supabase
      .from("benchmark_prices")
      .select("close")
      .gte("date", startDate)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { data: endRow } = await supabase
      .from("benchmark_prices")
      .select("close")
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!startRow || !endRow) continue; // no benchmark coverage for this window - excluded, not counted as a loss

    vsSp500PerEpisode.push(computeEpisodeVsSp500(episode, Number(startRow.close), Number(endRow.close)));
  }
  const vsSp500Aggregate = aggregateVsSp500(vsSp500PerEpisode);

  // ---- Exit vs. Your Own Plan -------------------------------------------
  const eligibleForExitVsPlan = closedEpisodes.filter((e) => e.thesisInvalidationPrice !== null);
  const admin = createAdminClient();
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY;

  // Dedupe by symbol - two episodes on the same symbol only need coverage
  // ensured once, and the deep backfill is single-flighted per symbol
  // anyway (see ensureDailyPricesDeepCoverage), so this just avoids issuing
  // the same coverage check twice in a row for no reason.
  const coverageBySymbol = new Map<string, boolean>();
  for (const episode of eligibleForExitVsPlan) {
    if (coverageBySymbol.has(episode.symbol) || !twelveDataKey) continue;
    const { data: openedDate } = await supabase.rpc("benchmark_trading_date", { p_ts: episode.openedAt });
    if (!openedDate) continue;
    try {
      const coverage = await ensureDailyPricesDeepCoverage(episode.symbol, openedDate, () =>
        fetchDailyPricesFromTwelveData(episode.symbol, twelveDataKey, DEEP_OUTPUTSIZE)
      );
      coverageBySymbol.set(episode.symbol, coverage.covered);
    } catch {
      coverageBySymbol.set(episode.symbol, false);
    }
  }

  const exitVsPlanResults: { episodeId: string; outcome: ExitVsPlanOutcome }[] = [];
  for (const episode of eligibleForExitVsPlan) {
    const covered = coverageBySymbol.get(episode.symbol) ?? false;
    if (!covered) {
      exitVsPlanResults.push({ episodeId: episode.id, outcome: { status: "no_price_data" } });
      continue;
    }

    const { data: openedDate } = await supabase.rpc("benchmark_trading_date", { p_ts: episode.openedAt });
    const { data: closedDate } = await supabase.rpc("benchmark_trading_date", { p_ts: episode.closedAt! });
    if (!openedDate || !closedDate) {
      exitVsPlanResults.push({ episodeId: episode.id, outcome: { status: "no_price_data" } });
      continue;
    }

    const { data: bars } = await admin
      .from("symbol_daily_prices")
      .select("date, close")
      .eq("symbol", episode.symbol)
      .gte("date", openedDate)
      .lte("date", closedDate)
      .order("date", { ascending: true });

    const outcome = computeExitVsPlan(
      episode,
      (bars ?? []).map((b) => ({ date: b.date, close: Number(b.close) })),
      true
    );
    exitVsPlanResults.push({ episodeId: episode.id, outcome });
  }

  const exitVsPlanOk = exitVsPlanResults
    .map((r) => r.outcome)
    .filter((o): o is Extract<ExitVsPlanOutcome, { status: "ok" }> => o.status === "ok");
  const exitVsPlanAggregate = aggregateExitVsPlan(exitVsPlanOk);

  const headline = buildHeadline({
    vsSp500: vsSp500Aggregate,
    exitVsPlan: exitVsPlanAggregate,
    winRate,
    overTradingDollars: overTradingCost.dollars,
  });

  return NextResponse.json({
    status: "ok",
    headline,
    totalEpisodes: episodes.length,
    closedEpisodes: closedEpisodes.length,
    winRate,
    avgWinLoss,
    profitFactor,
    holdingPeriods,
    overTradingCost,
    positionSizing,
    vsSp500: { aggregate: vsSp500Aggregate, perEpisode: vsSp500PerEpisode },
    exitVsPlan: { aggregate: exitVsPlanAggregate, perEpisode: exitVsPlanResults, eligible: eligibleForExitVsPlan.length },
  });
}
