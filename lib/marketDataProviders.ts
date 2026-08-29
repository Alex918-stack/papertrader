import { ALL_ASSETS } from "@/lib/stockSymbols";
import { QuoteData, ProfileData, DailyPricePoint } from "@/lib/marketDataCache";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const ASSET_BY_SYMBOL = new Map(ALL_ASSETS.map((a) => [a.symbol, a]));

// Stocks use the same ticker with both providers. Crypto needs translation:
// Finnhub wants "BINANCE:BTCUSDT" for quotes, Twelve Data wants "BTC/USD" for
// candles - the canonical symbol used everywhere else in the app is just "BTC".
export function resolveQuoteSymbol(symbol: string): string {
  return ASSET_BY_SYMBOL.get(symbol)?.quoteSymbol ?? symbol;
}
export function resolveCandleSymbol(symbol: string): string {
  return ASSET_BY_SYMBOL.get(symbol)?.candleSymbol ?? symbol;
}

export async function fetchQuoteFromFinnhub(symbol: string, apiKey: string): Promise<QuoteData> {
  const response = await fetch(
    `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(resolveQuoteSymbol(symbol))}&token=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (typeof data.c !== "number") {
    throw new Error(`No quote data returned for "${symbol}".`);
  }
  return { price: data.c, change: data.d, changePercent: data.dp };
}

// The one place /stock/profile2 gets called now - app/api/stocks/route.ts's
// market-cap lookup and app/api/chat/route.ts's getCompanyProfile used to
// each fetch and cache this independently. Both now go through
// getCachedProfile (lib/marketDataCache.ts) with this as the shared
// fetchUpstream. A miss here (Finnhub doesn't cover every symbol, crypto
// in particular) returns null fields rather than throwing, so a symbol
// with no profile still gets a real (empty) cached row instead of being
// re-fetched on every request forever.
export async function fetchProfileFromFinnhub(symbol: string, apiKey: string): Promise<ProfileData> {
  const response = await fetch(
    `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(resolveQuoteSymbol(symbol))}&token=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }
  const data = await response.json();
  return {
    name: data.name ?? null,
    industry: data.finnhubIndustry ?? null,
    exchange: data.exchange ?? null,
    country: data.country ?? null,
    website: data.weburl ?? null,
    ipo: data.ipo ?? null,
    // Finnhub reports marketCapitalization in millions of the reporting
    // currency - converted to raw dollars here, once, so nothing
    // downstream has to remember this or get it wrong.
    marketCap: typeof data.marketCapitalization === "number" ? data.marketCapitalization * 1_000_000 : null,
  };
}

export async function fetchDailyPricesFromTwelveData(
  symbol: string,
  apiKey: string,
  outputsize: number
): Promise<DailyPricePoint[]> {
  const response = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(resolveCandleSymbol(symbol))}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Twelve Data request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (data.status === "error" || !Array.isArray(data.values)) {
    throw new Error(data.message ?? "No historical data available for this symbol.");
  }
  return (data.values as { datetime: string; close: string; volume?: string }[])
    .map((v) => ({
      date: v.datetime,
      close: parseFloat(v.close),
      volume: v.volume !== undefined && Number.isFinite(parseFloat(v.volume)) ? parseFloat(v.volume) : null,
    }))
    .filter((p) => Number.isFinite(p.close));
}

const AVG_VOLUME_WINDOW = 20;

export function computeAvgDollarVolume(points: DailyPricePoint[]): number | null {
  // points is ascending by date - the trailing window is the *last* N,
  // not the first N.
  const window = points.slice(-AVG_VOLUME_WINDOW);
  const dollarVolumes = window
    .map((p) => (p.volume !== null ? p.close * p.volume : null))
    .filter((v): v is number => v !== null);
  if (dollarVolumes.length === 0) return null;
  return dollarVolumes.reduce((sum, v) => sum + v, 0) / dollarVolumes.length;
}
