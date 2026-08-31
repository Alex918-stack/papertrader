// ============================================================================
// Shared Finnhub quote/news fetchers
// ============================================================================
// Extracted from app/api/chat/route.ts, unchanged behavior - the new
// app/api/trading/draft-thesis/route.ts needs the same "current quote" and
// "recent news" lookups the chat tool suite already has, and duplicating
// them risked the two copies drifting apart (different error shapes, a fix
// applied to one but not the other). Every other chat tool (fundamentals,
// insider activity, earnings, etc.) stays local to chat/route.ts - those are
// genuinely chat-specific, not needed anywhere else yet.

import { ALL_ASSETS } from "@/lib/stockSymbols";

const ASSET_BY_SYMBOL = new Map(ALL_ASSETS.map((a) => [a.symbol, a]));

// Stocks use the same ticker with Finnhub as everywhere else in the app;
// crypto needs translation to Finnhub's "BINANCE:BTCUSDT" convention.
export function resolveFinnhubSymbol(symbol: string): string {
  return ASSET_BY_SYMBOL.get(symbol.toUpperCase())?.quoteSymbol ?? symbol;
}

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const FINNHUB_TIMEOUT_MS = 8000;

export async function finnhubGet(path: string, params: Record<string, string>) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return { error: "Finnhub API key is not configured on the server." };
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("token", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      return { error: `Finnhub request to ${path} failed (${res.status}).` };
    }
    return await res.json();
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Finnhub request to ${path} failed: ${err.message}`
          : `Finnhub request to ${path} failed.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStockQuote(symbol: string) {
  const data = await finnhubGet("/quote", { symbol: resolveFinnhubSymbol(symbol) });
  if (data.error) return data;
  if (data.c === 0 && data.h === 0 && data.l === 0) {
    return { error: `No quote data found for symbol "${symbol}". It may be an invalid ticker.` };
  }
  return {
    symbol,
    price: data.c,
    change: data.d,
    changePercent: data.dp,
    dayHigh: data.h,
    dayLow: data.l,
    dayOpen: data.o,
    previousClose: data.pc,
  };
}

export async function getStockNews(symbol: string) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const data = await finnhubGet("/company-news", {
    symbol,
    from: weekAgo.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  });
  if (data.error) return data;
  if (!Array.isArray(data)) {
    return { error: `No news data available for "${symbol}".` };
  }
  return data.slice(0, 5).map((item: { headline?: string; summary?: string; source?: string; datetime?: number }) => ({
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    date: new Date((item.datetime ?? 0) * 1000).toISOString().split("T")[0],
  }));
}
