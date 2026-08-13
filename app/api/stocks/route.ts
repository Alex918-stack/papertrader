import { NextRequest, NextResponse } from "next/server";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const quoteCache = new Map<string, { data: any; expires: number }>();
const CACHE_DURATION_MS = 10_000;

const candleCache = new Map<string, { data: any; expires: number }>();
const CANDLE_CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const type = request.nextUrl.searchParams.get("type") ?? "quote";

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY" },
      { status: 500 }
    );
  }

  try {
    if (type === "candles") {
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      if (!twelveDataKey) {
        return NextResponse.json(
          { error: "Server is missing TWELVE_DATA_API_KEY" },
          { status: 500 }
        );
      }

      const days = request.nextUrl.searchParams.get("days") ?? "30";
      const outputsize = Math.min(Math.max(parseInt(days, 10) || 30, 2), 365);
      const cacheKey = `${symbol}:${outputsize}`;

      const cached = candleCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return NextResponse.json(cached.data);
      }

      const response = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${outputsize}&apikey=${twelveDataKey}`
      );

      if (!response.ok) {
        if (cached) {
          return NextResponse.json(cached.data);
        }
        return NextResponse.json(
          { error: `Twelve Data request failed with status ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();

      if (data.status === "error" || !data.values) {
        if (cached) {
          return NextResponse.json(cached.data);
        }
        return NextResponse.json(
          { error: data.message ?? "No historical data available for this symbol." },
          { status: 404 }
        );
      }

      const points = data.values
        .map((v: { datetime: string; close: string }) => ({
          date: v.datetime,
          close: parseFloat(v.close),
        }))
        .reverse();

      const result = { symbol, points };
      candleCache.set(cacheKey, {
        data: result,
        expires: Date.now() + CANDLE_CACHE_DURATION_MS,
      });

      return NextResponse.json(result);
    }

    // default: current quote - check cache first
    const cached = quoteCache.get(symbol);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
    };

    quoteCache.set(symbol, {
      data: result,
      expires: Date.now() + CACHE_DURATION_MS,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}