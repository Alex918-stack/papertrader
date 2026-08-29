import { NextRequest, NextResponse } from "next/server";
import { getCachedQuote, getCachedProfile, getCachedDailyPrices } from "@/lib/marketDataCache";
import {
  fetchQuoteFromFinnhub,
  fetchProfileFromFinnhub,
  fetchDailyPricesFromTwelveData,
  computeAvgDollarVolume,
} from "@/lib/marketDataProviders";

// Fetches a window generous enough to cover every range the UI offers
// (1M/3M/6M/1Y) in one call, cached once per symbol in symbol_daily_prices
// - a request for "1Y" and a later request for "3M" on the same symbol
// now share one upstream fetch instead of two (the old per-outputsize
// cache key meant they never did).
const DAILY_PRICES_OUTPUTSIZE = 400;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const type = request.nextUrl.searchParams.get("type") ?? "quote";

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) {
    return NextResponse.json({ error: "Server is missing FINNHUB_API_KEY" }, { status: 500 });
  }

  if (type === "candles") {
    const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
    if (!twelveDataKey) {
      return NextResponse.json({ error: "Server is missing TWELVE_DATA_API_KEY" }, { status: 500 });
    }

    const days = parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10) || 30;
    const cacheResult = await getCachedDailyPrices(symbol, () =>
      fetchDailyPricesFromTwelveData(symbol, twelveDataKey, DAILY_PRICES_OUTPUTSIZE)
    );

    if (cacheResult.status === "pending") {
      return NextResponse.json({ symbol, status: "pending" });
    }
    if (cacheResult.status === "unavailable") {
      return NextResponse.json({ symbol, status: "unavailable", error: cacheResult.error });
    }

    const allPoints = cacheResult.data;
    const windowStart = Date.now() - days * 24 * 60 * 60 * 1000;
    const points = allPoints
      .filter((p) => new Date(p.date).getTime() >= windowStart)
      .map((p) => ({ date: p.date, close: p.close }));

    return NextResponse.json({
      symbol,
      status: cacheResult.status,
      asOf: cacheResult.asOf,
      points,
      avgDollarVolume20d: computeAvgDollarVolume(allPoints),
    });
  }

  // default: current quote + profile (market cap), each independently
  // cached and independently single-flighted - a cold quote and a warm
  // profile for the same symbol don't block on each other.
  const [quoteResult, profileResult] = await Promise.all([
    getCachedQuote(symbol, () => fetchQuoteFromFinnhub(symbol, finnhubKey)),
    getCachedProfile(symbol, () => fetchProfileFromFinnhub(symbol, finnhubKey)),
  ]);

  if (quoteResult.status === "pending") {
    return NextResponse.json({ symbol, status: "pending" });
  }
  if (quoteResult.status === "unavailable") {
    return NextResponse.json({ symbol, status: "unavailable", error: quoteResult.error });
  }

  // Market cap is a secondary field on the quote response - a profile
  // that's still pending or failed shouldn't block the quote itself from
  // rendering, it just means marketCap comes back null for now.
  const marketCap =
    profileResult.status === "fresh" || profileResult.status === "stale" ? profileResult.data.marketCap : null;

  return NextResponse.json({
    symbol,
    status: quoteResult.status,
    asOf: quoteResult.asOf,
    price: quoteResult.data.price,
    change: quoteResult.data.change,
    changePercent: quoteResult.data.changePercent,
    marketCap,
  });
}
