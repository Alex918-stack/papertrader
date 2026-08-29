// ============================================================================
// Honest execution pricing: estimated spread + slippage
// ============================================================================
// This is the ONLY place spread/slippage numbers are computed. The order
// ticket preview (OrderTicket, before the user commits) and the actual trade
// execution (PortfolioContext.trade(), both the signed-in Postgres path and
// the guest in-memory path) all call computeExecutionPricing below with the
// same inputs shape. There is no second implementation of this math anywhere
// else - if the numbers ever need retuning, they change here and nowhere
// else.
//
// Everything in this file is an ESTIMATE. This app's market data tier gives
// us a single last-trade price with no real bid/ask and no real order-book
// depth. The bands and multipliers below are a defensible heuristic, not
// real market microstructure - the UI must always label them as estimates
// ("Est. spread", "Est. slippage") rather than presenting them as quoted
// values.

import { fetchWithPendingRetry } from "@/lib/fetchMarketData";

export type OrderSide = "BUY" | "SELL";

export interface SymbolLiquidityData {
  /** Market capitalization in USD, or null if unavailable (fetch failure, or a symbol - e.g. crypto - that Finnhub's company-profile endpoint doesn't cover). */
  marketCap: number | null;
  /** Trailing ~20-trading-day average daily dollar volume (close * volume per bar), or null if unavailable. */
  avgDollarVolume20d: number | null;
}

export interface ExecutionPricingInput {
  quotedPrice: number;
  side: OrderSide;
  shares: number;
  liquidity: SymbolLiquidityData;
}

export interface ExecutionPricing {
  quotedPrice: number;
  fillPrice: number;
  spreadCost: number;
  slippageCost: number;
  /** The half-spread bps actually applied, exposed for display/debugging - not stored anywhere. */
  spreadBps: number;
  /** The slippage bps actually applied, exposed for display/debugging - not stored anywhere. */
  slippageBps: number;
}

// ----------------------------------------------------------------------------
// Spread model
// ----------------------------------------------------------------------------
// Base bps by price level, adjusted by a market-cap liquidity multiplier,
// then clamped. Applied as a HALF-spread each direction (buys pay
// quotedPrice + half-spread, sells receive quotedPrice - half-spread) -
// modeling the last trade as sitting at the midpoint, since that's the only
// price this data tier actually gives us.

// Ordered ascending by price threshold - the first band whose maxPrice the
// quote is under wins. Lower-priced stocks trade with much wider relative
// spreads in practice; this is the well-known shape of that effect, not a
// precise fit to any specific dataset.
const SPREAD_BPS_BY_PRICE_BAND: { maxPrice: number; bps: number }[] = [
  { maxPrice: 1, bps: 150 },
  { maxPrice: 10, bps: 35 },
  { maxPrice: 50, bps: 10 },
  { maxPrice: 200, bps: 5 },
  { maxPrice: Infinity, bps: 3 },
];

// Applied on top of the price-band base. Keyed by minimum market cap in USD.
const MARKET_CAP_BANDS = [
  { minMarketCap: 200_000_000_000, multiplier: 0.6 }, // mega-cap
  { minMarketCap: 10_000_000_000, multiplier: 1.0 }, // large-cap
  { minMarketCap: 2_000_000_000, multiplier: 1.8 }, // mid-cap
  { minMarketCap: 0, multiplier: 3.0 }, // small-cap
];

// Applied when marketCap is null - a deliberately conservative
// middle-of-the-road guess (wider than large-cap, narrower than small-cap)
// rather than assuming the best case for data we don't have.
const UNKNOWN_MARKET_CAP_MULTIPLIER = 1.5;

const SPREAD_BPS_MIN = 2;
const SPREAD_BPS_MAX = 400;

// ----------------------------------------------------------------------------
// Slippage model
// ----------------------------------------------------------------------------
// Bps added on top of spread, banded by participation rate: this order's
// dollar size as a fraction of trailing 20-day average dollar volume. This
// is a coarse proxy for market impact, not a real order-book-depth model -
// real slippage depends on depth and the other orders arriving at the same
// moment, neither of which this data tier exposes.

// Ordered ascending by participation threshold - same "first band that
// fits" matching as the spread bands above.
const SLIPPAGE_BPS_BY_PARTICIPATION_BAND: { maxParticipation: number; bps: number }[] = [
  { maxParticipation: 0.0005, bps: 0 }, // < 0.05% of ADV
  { maxParticipation: 0.005, bps: 3 }, // < 0.5%
  { maxParticipation: 0.02, bps: 12 }, // < 2%
  { maxParticipation: 0.05, bps: 30 }, // < 5%
  { maxParticipation: 0.1, bps: 75 }, // < 10%
  { maxParticipation: Infinity, bps: 150 }, // >= 10%
];

// Applied when avgDollarVolume20d is null (new listing, fetch failure) -
// flat and conservative rather than zero, since "no data" should never
// look identical to "definitely liquid."
const UNKNOWN_VOLUME_SLIPPAGE_BPS = 15;

const SLIPPAGE_BPS_MAX = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function baseSpreadBps(price: number): number {
  const band = SPREAD_BPS_BY_PRICE_BAND.find((b) => price < b.maxPrice);
  return (band ?? SPREAD_BPS_BY_PRICE_BAND[SPREAD_BPS_BY_PRICE_BAND.length - 1]).bps;
}

function marketCapMultiplier(marketCap: number | null): number {
  if (marketCap === null) return UNKNOWN_MARKET_CAP_MULTIPLIER;
  const band = MARKET_CAP_BANDS.find((b) => marketCap >= b.minMarketCap);
  return (band ?? MARKET_CAP_BANDS[MARKET_CAP_BANDS.length - 1]).multiplier;
}

function computeSpreadBps(quotedPrice: number, marketCap: number | null): number {
  const raw = baseSpreadBps(quotedPrice) * marketCapMultiplier(marketCap);
  return clamp(raw, SPREAD_BPS_MIN, SPREAD_BPS_MAX);
}

function computeSlippageBps(orderDollarSize: number, avgDollarVolume20d: number | null): number {
  if (avgDollarVolume20d === null || avgDollarVolume20d <= 0) {
    return UNKNOWN_VOLUME_SLIPPAGE_BPS;
  }
  const participation = orderDollarSize / avgDollarVolume20d;
  const band = SLIPPAGE_BPS_BY_PARTICIPATION_BAND.find((b) => participation < b.maxParticipation);
  const bps = (band ?? SLIPPAGE_BPS_BY_PARTICIPATION_BAND[SLIPPAGE_BPS_BY_PARTICIPATION_BAND.length - 1]).bps;
  return clamp(bps, 0, SLIPPAGE_BPS_MAX);
}

/**
 * The one place order-fill price, spread cost, and slippage cost are
 * computed - see the file header for why nothing else duplicates this math.
 */
export function computeExecutionPricing({
  quotedPrice,
  side,
  shares,
  liquidity,
}: ExecutionPricingInput): ExecutionPricing {
  if (!(quotedPrice > 0) || !(shares > 0)) {
    return {
      quotedPrice,
      fillPrice: quotedPrice,
      spreadCost: 0,
      slippageCost: 0,
      spreadBps: 0,
      slippageBps: 0,
    };
  }

  const orderDollarSize = quotedPrice * shares;
  const spreadBps = computeSpreadBps(quotedPrice, liquidity.marketCap);
  const slippageBps = computeSlippageBps(orderDollarSize, liquidity.avgDollarVolume20d);

  // Half the spread each direction - the quote is modeled as sitting at the
  // midpoint (see the file header for why: it's the only price this data
  // tier gives us). Slippage is applied on top, in the same adverse
  // direction, never favorable - market impact from your own order never
  // helps you.
  const spreadCost = orderDollarSize * (spreadBps / 2 / 10000);
  const slippageCost = orderDollarSize * (slippageBps / 10000);
  const totalAdverseCost = spreadCost + slippageCost;

  const fillPrice =
    side === "BUY"
      ? quotedPrice + totalAdverseCost / shares
      : quotedPrice - totalAdverseCost / shares;

  return { quotedPrice, fillPrice, spreadCost, slippageCost, spreadBps, slippageBps };
}

/**
 * Fetches the two liquidity inputs computeExecutionPricing needs, from the
 * same /api/stocks endpoint the rest of the app already calls for quotes and
 * candles - no separate data dependency. Uses fetchWithPendingRetry so a
 * cold cache gets one short retry window rather than reading a pending
 * response's missing fields as unknown; a genuine failure or timeout still
 * falls through to the "unknown" fallbacks above rather than blocking or
 * failing the trade, the same way a missing price already can't block a
 * trade that already has one.
 */
export async function fetchSymbolLiquidity(symbol: string): Promise<SymbolLiquidityData> {
  try {
    const [quote, candles] = (await Promise.all([
      fetchWithPendingRetry(`/api/stocks?symbol=${encodeURIComponent(symbol)}`),
      fetchWithPendingRetry(`/api/stocks?symbol=${encodeURIComponent(symbol)}&type=candles&days=30`),
    ])) as [{ marketCap?: number } | null, { avgDollarVolume20d?: number } | null];

    return {
      marketCap: typeof quote?.marketCap === "number" ? quote.marketCap : null,
      avgDollarVolume20d:
        typeof candles?.avgDollarVolume20d === "number" ? candles.avgDollarVolume20d : null,
    };
  } catch {
    return { marketCap: null, avgDollarVolume20d: null };
  }
}
