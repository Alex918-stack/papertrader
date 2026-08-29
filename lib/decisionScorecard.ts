// ============================================================================
// Decision quality scorecard: pure computation
// ============================================================================
// Every function here takes already-fetched data and returns a result - no
// Supabase client, no fetch calls. The route (app/api/journal/scorecard)
// owns fetching (including the deep price backfill); this file owns turning
// that data into honest numbers, so the math can be reasoned about (and
// tested) without a database in the loop.
//
// The core discipline this file exists to enforce: a metric is either
// "available" with a real value, or "locked" with an honest reason and a
// progress readout - never a fabricated number standing in for "not enough
// data yet." See MetricGate below.

export type MetricGate<T> =
  | { status: "locked"; have: number; need: number }
  | { status: "available"; value: T };

function gate<T>(have: number, need: number, value: T): MetricGate<T> {
  return have >= need ? { status: "available", value } : { status: "locked", have, need };
}

// ----------------------------------------------------------------------------
// Input shapes
// ----------------------------------------------------------------------------

export interface ScorecardTransaction {
  type: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  executedAt: string;
  quotedPrice: number | null;
  spreadCost: number | null;
  slippageCost: number | null;
}

export interface ScorecardEpisode {
  id: string;
  symbol: string;
  openedAt: string;
  closedAt: string | null;
  thesisInvalidationPrice: number | null;
  exitReflection: string | null;
  // Ordered by executedAt ascending - every function below relies on
  // transactions[0] being the opening buy and, for closed episodes,
  // transactions[transactions.length - 1] being the closing sell.
  transactions: ScorecardTransaction[];
}

// ----------------------------------------------------------------------------
// Episode P&L - the one place realized profit/loss is computed, reused by
// win rate, avg win/loss, profit factor, and holding period.
// ----------------------------------------------------------------------------

export interface EpisodePnl {
  buysCost: number;
  sellProceeds: number;
  pnl: number;
  pnlPercent: number;
  isWin: boolean;
}

// A closed episode always has at least one buy (nothing to close otherwise),
// so buysCost is always > 0 here - no divide-by-zero guard needed the way
// the critique route's version of this same formula needs one for episodes
// that might still be open.
export function computeEpisodePnl(episode: ScorecardEpisode): EpisodePnl {
  const buysCost = episode.transactions.filter((t) => t.type === "buy").reduce((sum, t) => sum + t.total, 0);
  const sellProceeds = episode.transactions.filter((t) => t.type === "sell").reduce((sum, t) => sum + t.total, 0);
  const pnl = sellProceeds - buysCost;
  return {
    buysCost,
    sellProceeds,
    pnl,
    pnlPercent: buysCost > 0 ? (pnl / buysCost) * 100 : 0,
    isWin: pnl > 0,
  };
}

function closedOnly(episodes: ScorecardEpisode[]): ScorecardEpisode[] {
  return episodes.filter((e) => e.closedAt !== null);
}

// ----------------------------------------------------------------------------
// Win rate, avg win/loss, profit factor
// ----------------------------------------------------------------------------
// A win-rate estimate on a handful of trades is noise, not a signal - this
// threshold isn't a claim of statistical significance (even at 30 trades the
// confidence interval on a win rate is still wide), it's a floor against
// showing "100% win rate" off one lucky trade.
export const MIN_CLOSED_FOR_RATES = 10;

export interface WinRateResult {
  rate: number;
  wins: number;
  losses: number;
  total: number;
}

export interface AvgWinLossResult {
  avgWinPct: number | null; // null = no winners yet
  avgLossPct: number | null; // null = no losers yet
}

export interface ProfitFactorResult {
  value: number | null; // null = no losses recorded yet (undefined, not infinite)
  grossProfit: number;
  grossLoss: number;
}

export function computeRateMetrics(episodes: ScorecardEpisode[]): {
  winRate: MetricGate<WinRateResult>;
  avgWinLoss: MetricGate<AvgWinLossResult>;
  profitFactor: MetricGate<ProfitFactorResult>;
} {
  const closed = closedOnly(episodes);
  const pnls = closed.map(computeEpisodePnl);
  const wins = pnls.filter((p) => p.isWin);
  const losses = pnls.filter((p) => !p.isWin);

  const winRateValue: WinRateResult = {
    rate: closed.length > 0 ? wins.length / closed.length : 0,
    wins: wins.length,
    losses: losses.length,
    total: closed.length,
  };

  const avgWinLossValue: AvgWinLossResult = {
    avgWinPct: wins.length > 0 ? wins.reduce((sum, p) => sum + p.pnlPercent, 0) / wins.length : null,
    avgLossPct: losses.length > 0 ? losses.reduce((sum, p) => sum + p.pnlPercent, 0) / losses.length : null,
  };

  const grossProfit = wins.reduce((sum, p) => sum + p.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, p) => sum + p.pnl, 0));
  const profitFactorValue: ProfitFactorResult = {
    value: grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit,
    grossLoss,
  };

  return {
    winRate: gate(closed.length, MIN_CLOSED_FOR_RATES, winRateValue),
    avgWinLoss: gate(closed.length, MIN_CLOSED_FOR_RATES, avgWinLossValue),
    profitFactor: gate(closed.length, MIN_CLOSED_FOR_RATES, profitFactorValue),
  };
}

// ----------------------------------------------------------------------------
// Holding period: winners vs. losers
// ----------------------------------------------------------------------------
// Gated per side, independently - a trader who's 9-for-9 clears
// MIN_CLOSED_FOR_RATES above but still can't get a "losers" average. Show
// whichever side has enough data rather than hiding both because one is short.
export const MIN_PER_SIDE_FOR_HOLDING_PERIOD = 5;

export interface HoldingPeriodResult {
  avgDays: number;
  count: number;
}

export function computeHoldingPeriods(episodes: ScorecardEpisode[]): {
  winners: MetricGate<HoldingPeriodResult>;
  losers: MetricGate<HoldingPeriodResult>;
} {
  const closed = closedOnly(episodes);

  function daysHeld(e: ScorecardEpisode): number {
    return (new Date(e.closedAt!).getTime() - new Date(e.openedAt).getTime()) / (24 * 60 * 60 * 1000);
  }

  const winners = closed.filter((e) => computeEpisodePnl(e).isWin);
  const losers = closed.filter((e) => !computeEpisodePnl(e).isWin);

  const winnersValue: HoldingPeriodResult = {
    avgDays: winners.length > 0 ? winners.reduce((sum, e) => sum + daysHeld(e), 0) / winners.length : 0,
    count: winners.length,
  };
  const losersValue: HoldingPeriodResult = {
    avgDays: losers.length > 0 ? losers.reduce((sum, e) => sum + daysHeld(e), 0) / losers.length : 0,
    count: losers.length,
  };

  return {
    winners: gate(winners.length, MIN_PER_SIDE_FOR_HOLDING_PERIOD, winnersValue),
    losers: gate(losers.length, MIN_PER_SIDE_FOR_HOLDING_PERIOD, losersValue),
  };
}

// ----------------------------------------------------------------------------
// Over-trading cost
// ----------------------------------------------------------------------------
// Deliberately NOT a modeled hypothetical (e.g. "what a single buy+sell
// would have cost at today's liquidity") - that would need current
// marketCap/volume standing in for historical conditions, an approximation
// on top of an approximation. Instead: every transaction beyond the first
// buy and the last sell is, by definition, an add-on or a partial trim -
// optional trades a buy-once-sell-once trader would never have made. Their
// spread_cost/slippage_cost are real numbers already paid, not modeled.
// An episode with exactly one buy and one sell costs exactly $0 here,
// correctly - the necessary cost of entering and exiting at all isn't
// "over-trading."
//
// Episodes are excluded entirely (not counted as $0) when any of their
// transactions predate execution-cost modeling (0007) - same "excluded,
// never treated as zero" stance as everywhere else honest-execution data
// is missing.
export const MIN_ELIGIBLE_FOR_OVER_TRADING_PCT = 3;

export interface OverTradingCostResult {
  totalCost: number; // spread + slippage across every eligible transaction
  excessCost: number; // the portion attributable to add-ons/trims beyond entry+exit
  eligibleEpisodes: number;
  totalInvested: number; // sum of buysCost across eligible episodes, for the % framing
}

function hasCompleteCostData(t: ScorecardTransaction): boolean {
  return t.quotedPrice !== null && t.spreadCost !== null && t.slippageCost !== null;
}

export function computeOverTradingCost(episodes: ScorecardEpisode[]): {
  dollars: OverTradingCostResult; // always available - a real sum needs no minimum
  percent: MetricGate<number>;
} {
  const eligible = closedOnly(episodes).filter(
    (e) => e.transactions.length >= 2 && e.transactions.every(hasCompleteCostData)
  );

  let totalCost = 0;
  let excessCost = 0;
  let totalInvested = 0;

  for (const episode of eligible) {
    const cost = (t: ScorecardTransaction) => (t.spreadCost ?? 0) + (t.slippageCost ?? 0);
    const episodeCost = episode.transactions.reduce((sum, t) => sum + cost(t), 0);
    const interior = episode.transactions.slice(1, -1);
    const episodeExcess = interior.reduce((sum, t) => sum + cost(t), 0);

    totalCost += episodeCost;
    excessCost += episodeExcess;
    totalInvested += computeEpisodePnl(episode).buysCost;
  }

  const dollars: OverTradingCostResult = { totalCost, excessCost, eligibleEpisodes: eligible.length, totalInvested };
  const percentValue = totalInvested > 0 ? (excessCost / totalInvested) * 100 : 0;

  return {
    dollars,
    percent: gate(eligible.length, MIN_ELIGIBLE_FOR_OVER_TRADING_PCT, percentValue),
  };
}

// ----------------------------------------------------------------------------
// Position sizing consistency
// ----------------------------------------------------------------------------
// "Size" is the opening buy only (transactions[0].total) - a deliberate
// choice: add-ons are a separate later decision (scaling in), not part of
// the original sizing call this metric is about. Cash available at entry
// comes from replaying every transaction in the portfolio chronologically
// from STARTING_CASH, which is exact (cash only ever moves via buy/sell in
// this app, confirmed in execute_trade) rather than approximated.
export const MIN_OPENED_FOR_SIZING = 5;

export interface PositionSizingResult {
  avgPercentOfCash: number;
  minPercentOfCash: number;
  maxPercentOfCash: number;
  count: number;
}

/**
 * allTransactionsOrdered: every transaction for the portfolio, ascending by
 * executedAt, regardless of episode - needed to replay the running cash
 * balance. episodes: the ones to size (open or closed both count; sizing is
 * about entry behavior, which doesn't need a close to exist).
 */
export function computePositionSizing(
  startingCash: number,
  allTransactionsOrdered: ScorecardTransaction[],
  episodes: ScorecardEpisode[]
): MetricGate<PositionSizingResult> {
  // executedAt -> cash balance immediately BEFORE that transaction.
  const cashBeforeByTimestamp = new Map<string, number>();
  let runningCash = startingCash;
  for (const t of allTransactionsOrdered) {
    cashBeforeByTimestamp.set(t.executedAt, runningCash);
    runningCash += t.type === "buy" ? -t.total : t.total;
  }

  const percentages: number[] = [];
  for (const episode of episodes) {
    const opening = episode.transactions[0];
    if (!opening || opening.type !== "buy") continue;
    const cashBefore = cashBeforeByTimestamp.get(opening.executedAt);
    if (cashBefore === undefined || cashBefore <= 0) continue;
    percentages.push((opening.total / cashBefore) * 100);
  }

  const value: PositionSizingResult = {
    avgPercentOfCash: percentages.length > 0 ? percentages.reduce((s, p) => s + p, 0) / percentages.length : 0,
    minPercentOfCash: percentages.length > 0 ? Math.min(...percentages) : 0,
    maxPercentOfCash: percentages.length > 0 ? Math.max(...percentages) : 0,
    count: percentages.length,
  };

  return gate(percentages.length, MIN_OPENED_FOR_SIZING, value);
}

// ----------------------------------------------------------------------------
// Performance vs. S&P 500, per episode
// ----------------------------------------------------------------------------
// Deliberately per-CLOSED-episode, not the whole-portfolio-since-signup
// number BenchmarkComparison already shows elsewhere - that one includes
// idle cash and deposit timing; this one asks the narrower, scorecard-
// specific question: for the picks you actually closed, did they beat SPY
// over the exact same holding window.
export const MIN_CLOSED_FOR_VS_SP500_AGGREGATE = 10;

export interface EpisodeVsSp500 {
  episodeId: string;
  yourReturnPct: number;
  spReturnPct: number;
  beat: boolean;
}

export function computeEpisodeVsSp500(
  episode: ScorecardEpisode,
  startClose: number,
  endClose: number
): EpisodeVsSp500 {
  const pnl = computeEpisodePnl(episode);
  const spReturnPct = ((endClose - startClose) / startClose) * 100;
  return {
    episodeId: episode.id,
    yourReturnPct: pnl.pnlPercent,
    spReturnPct,
    beat: pnl.pnlPercent > spReturnPct,
  };
}

export interface VsSp500Aggregate {
  beatCount: number;
  total: number;
}

export function aggregateVsSp500(perEpisode: EpisodeVsSp500[]): MetricGate<VsSp500Aggregate> {
  const value: VsSp500Aggregate = {
    beatCount: perEpisode.filter((e) => e.beat).length,
    total: perEpisode.length,
  };
  return gate(perEpisode.length, MIN_CLOSED_FOR_VS_SP500_AGGREGATE, value);
}

// ----------------------------------------------------------------------------
// Concentration - explicitly NOT here
// ----------------------------------------------------------------------------
// Concentration is current-state (today's holdings vs. today's quotes), and
// this app already computes exactly that shape of number client-side via
// usePortfolioValue for every other live-value display. Reconstructing it
// historically would need a portfolio-value snapshot at every past entry
// date, which isn't stored - approximating that with today's portfolio size
// standing in for the past would be dishonest, so it isn't attempted, and
// concentration is computed in the component that renders it, not here.

// ----------------------------------------------------------------------------
// Exit vs. Your Own Plan
// ----------------------------------------------------------------------------
// See lib/marketDataCache.ts's ensureDailyPricesDeepCoverage for why this
// needs its own backfill path. Only covers episodes with a numeric
// thesis_invalidation_price - prose-only invalidations aren't parsed; that
// would be exactly the hand-waving this metric exists to avoid.
export const MIN_ELIGIBLE_FOR_EXIT_VS_PLAN_AGGREGATE = 5;

export type ExitVsPlanOutcome =
  | { status: "no_price_data" }
  | {
      status: "ok";
      invalidationHit: boolean;
      isWin: boolean;
      exitPrice: number;
      selfReported: string | null;
      // Whether the objective check and the self-reported tag point the
      // same direction - only meaningful when both are present. Never
      // computed as a verdict about the user; the caller presents this as
      // an observation, not a fact about their intent.
      agreesWithSelfReport: boolean | null;
    };

const SELF_REPORT_IMPLIES_INVALIDATION_HIT = new Set(["invalidated_as_expected"]);
const SELF_REPORT_IMPLIES_INVALIDATION_NOT_HIT = new Set(["thesis_played_out"]);

/**
 * dailyCloses: this episode's symbol's closing prices for every day
 * covered, ascending by date - already fetched by the route after
 * ensuring coverage. covered: false means the backfill couldn't reach far
 * enough back (or the fetch failed) - the caller shows "no price data for
 * this window" rather than computing on a partial window.
 */
export function computeExitVsPlan(
  episode: ScorecardEpisode,
  dailyCloses: { date: string; close: number }[],
  covered: boolean
): ExitVsPlanOutcome {
  if (!covered) return { status: "no_price_data" };

  const invalidationPrice = episode.thesisInvalidationPrice!;
  const invalidationHit = dailyCloses.some((d) => d.close <= invalidationPrice);
  const pnl = computeEpisodePnl(episode);
  const lastSell = [...episode.transactions].reverse().find((t) => t.type === "sell");

  let agreesWithSelfReport: boolean | null = null;
  if (episode.exitReflection) {
    if (SELF_REPORT_IMPLIES_INVALIDATION_HIT.has(episode.exitReflection)) {
      agreesWithSelfReport = invalidationHit;
    } else if (SELF_REPORT_IMPLIES_INVALIDATION_NOT_HIT.has(episode.exitReflection)) {
      agreesWithSelfReport = !invalidationHit;
    }
  }

  return {
    status: "ok",
    invalidationHit,
    isWin: pnl.isWin,
    exitPrice: lastSell?.price ?? 0,
    selfReported: episode.exitReflection,
    agreesWithSelfReport,
  };
}

export interface ExitVsPlanAggregate {
  eligible: number;
  exitedBeforeInvalidationAtALoss: number;
  invalidationHonored: number;
  disagreementsWithSelfReport: number;
}

export function aggregateExitVsPlan(
  outcomes: Extract<ExitVsPlanOutcome, { status: "ok" }>[]
): MetricGate<ExitVsPlanAggregate> {
  const value: ExitVsPlanAggregate = {
    eligible: outcomes.length,
    exitedBeforeInvalidationAtALoss: outcomes.filter((o) => !o.invalidationHit && !o.isWin).length,
    invalidationHonored: outcomes.filter((o) => o.invalidationHit).length,
    disagreementsWithSelfReport: outcomes.filter((o) => o.agreesWithSelfReport === false).length,
  };
  return gate(outcomes.length, MIN_ELIGIBLE_FOR_EXIT_VS_PLAN_AGGREGATE, value);
}

// ----------------------------------------------------------------------------
// Headline sentence
// ----------------------------------------------------------------------------
// Deterministic, not a fabricated composite grade - always traceable to one
// real, already-computed component. Checked in a fixed priority order and
// stops at the first available signal, so which sentence a given user sees
// depends only on which real numbers they've unlocked, never on an opaque
// weighting between them.
export interface ScorecardHeadlineInput {
  vsSp500: MetricGate<VsSp500Aggregate>;
  exitVsPlan: MetricGate<ExitVsPlanAggregate>;
  winRate: MetricGate<WinRateResult>;
  overTradingDollars: OverTradingCostResult;
}

export function buildHeadline(input: ScorecardHeadlineInput): string {
  if (input.vsSp500.status === "available") {
    const { beatCount, total } = input.vsSp500.value;
    return beatCount > total / 2
      ? `You beat the S&P 500 on ${beatCount} of your ${total} closed positions.`
      : `The S&P 500 beat you on ${total - beatCount} of your ${total} closed positions.`;
  }

  if (input.exitVsPlan.status === "available") {
    const { exitedBeforeInvalidationAtALoss, eligible } = input.exitVsPlan.value;
    return exitedBeforeInvalidationAtALoss > 0
      ? `You exited at a loss before your own stated invalidation was hit on ${exitedBeforeInvalidationAtALoss} of ${eligible} positions.`
      : `Every one of your ${eligible} checked exits matched your own stated invalidation level.`;
  }

  if (input.winRate.status === "available") {
    const { wins, total } = input.winRate.value;
    return `You've closed ${wins} winning positions out of ${total}.`;
  }

  if (input.overTradingDollars.eligibleEpisodes > 0 && input.overTradingDollars.excessCost > 0) {
    return `Add-ons and partial trims have cost you $${input.overTradingDollars.excessCost.toFixed(2)} in spread and slippage so far.`;
  }

  return "Keep trading with a thesis - your scorecard fills in as positions close.";
}
