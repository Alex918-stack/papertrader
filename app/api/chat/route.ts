import { NextRequest, NextResponse } from "next/server";
import { getAuthedEmail } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/marketDataCache";
import { fetchProfileFromFinnhub } from "@/lib/marketDataProviders";
import { checkCooldown, getCooldownKey } from "@/lib/rateLimitCooldown";
import { finnhubGet, getStockQuote, getStockNews } from "@/lib/finnhubClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface HoldingInput {
  symbol: string;
  shares: number;
  avgCost: number;
}

interface ProposedTrade {
  symbol: string;
  action: "BUY" | "SELL";
  shares: number;
  rationale: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; id?: string; args: Record<string, unknown> };
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

async function searchSymbol(query: string) {
  const data = await finnhubGet("/search", { q: query });
  if (data.error) return data;
  const results = (data.result ?? []) as Array<{
    symbol?: string;
    description?: string;
    type?: string;
  }>;
  if (results.length === 0) {
    return { error: `No symbols found matching "${query}".` };
  }
  return results.slice(0, 8).map((r) => ({
    symbol: r.symbol,
    description: r.description,
    type: r.type,
  }));
}

async function getCompanyProfile(symbol: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { error: "Finnhub API key is not configured on the server." };

  // Shared with app/api/stocks/route.ts's market-cap lookup - both read
  // symbol_profiles now, so a symbol already looked up for its market cap
  // (or vice versa) doesn't cost a second Finnhub call here.
  const result = await getCachedProfile(symbol, () => fetchProfileFromFinnhub(symbol, apiKey));

  if (result.status === "pending") {
    return { error: `Company profile for "${symbol}" is still loading - try again in a moment.` };
  }
  if (result.status === "unavailable") {
    return { error: result.error };
  }
  if (!result.data.name) {
    return { error: `No company profile found for "${symbol}".` };
  }
  return {
    symbol,
    name: result.data.name,
    industry: result.data.industry,
    exchange: result.data.exchange,
    country: result.data.country,
    marketCapitalization: result.data.marketCap,
    ipo: result.data.ipo,
    website: result.data.website,
  };
}

async function getCompanyFundamentals(symbol: string) {
  const data = await finnhubGet("/stock/metric", { symbol, metric: "all" });
  if (data.error) return data;
  const m = data.metric ?? {};
  if (Object.keys(m).length === 0) {
    return { error: `No fundamentals data found for "${symbol}".` };
  }
  return {
    symbol,
    peTTM: m.peBasicExclExtraTTM ?? null,
    epsTTM: m.epsBasicExclExtraItemsTTM ?? null,
    marketCapitalization: m.marketCapitalization ?? null,
    week52High: m["52WeekHigh"] ?? null,
    week52Low: m["52WeekLow"] ?? null,
    dividendYieldAnnual: m.dividendYieldIndicatedAnnual ?? null,
    beta: m.beta ?? null,
  };
}

async function getPeerComparison(symbol: string) {
  const peersData = await finnhubGet("/stock/peers", { symbol });
  if (!Array.isArray(peersData) || peersData.length === 0) {
    return peersData?.error ? peersData : { error: `No peer data found for "${symbol}".` };
  }
  const peers = (peersData as string[]).filter((p) => p !== symbol).slice(0, 4);
  return Promise.all(
    [symbol, ...peers].map(async (sym) => ({ symbol: sym, ...(await getStockQuote(sym)) }))
  );
}

async function getAnalystRatings(symbol: string) {
  const data = await finnhubGet("/stock/recommendation", { symbol });
  if (data.error) return data;
  const trends = Array.isArray(data)
    ? (data.slice(0, 3) as Array<{
        period?: string;
        strongBuy?: number;
        buy?: number;
        hold?: number;
        sell?: number;
        strongSell?: number;
      }>)
    : [];
  if (trends.length === 0) {
    return { error: `No analyst ratings found for "${symbol}".` };
  }

  const priceTargetData = await finnhubGet("/stock/price-target", { symbol });

  return {
    symbol,
    recentTrends: trends.map((t) => ({
      period: t.period,
      strongBuy: t.strongBuy,
      buy: t.buy,
      hold: t.hold,
      sell: t.sell,
      strongSell: t.strongSell,
    })),
    priceTarget: priceTargetData.error
      ? null
      : {
          targetHigh: priceTargetData.targetHigh,
          targetLow: priceTargetData.targetLow,
          targetMean: priceTargetData.targetMean,
          targetMedian: priceTargetData.targetMedian,
        },
  };
}

async function getEarningsCalendar(symbol: string) {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 90);

  const data = await finnhubGet("/calendar/earnings", {
    symbol,
    from: today.toISOString().split("T")[0],
    to: future.toISOString().split("T")[0],
  });
  if (data.error) return data;

  const events = data.earningsCalendar ?? [];
  if (events.length === 0) {
    return { message: `No upcoming earnings date found for "${symbol}" in the next 90 days.` };
  }
  return events.slice(0, 2).map((e: { date?: string; quarter?: string; year?: number; epsEstimate?: number; revenueEstimate?: number }) => ({
    date: e.date,
    quarter: e.quarter,
    year: e.year,
    epsEstimate: e.epsEstimate,
    revenueEstimate: e.revenueEstimate,
  }));
}

const INSIDER_TRANSACTION_CODES: Record<string, string> = {
  P: "Open market purchase",
  S: "Open market sale",
  A: "Grant/award",
  D: "Sale to issuer",
  F: "Tax withholding",
  M: "Option exercise",
  G: "Gift",
  C: "Conversion",
};

async function getInsiderActivity(symbol: string) {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const [transactionsData, sentimentData] = await Promise.all([
    finnhubGet("/stock/insider-transactions", { symbol }),
    finnhubGet("/stock/insider-sentiment", {
      symbol,
      from: sixMonthsAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    }),
  ]);

  if (transactionsData.error && sentimentData.error) {
    return { error: `No insider activity data available for "${symbol}".` };
  }

  const rawTransactions = Array.isArray(transactionsData.data) ? transactionsData.data : [];
  const transactions = rawTransactions
    .slice(0, 10)
    .map((t: { name?: string; share?: number; change?: number; transactionDate?: string; transactionCode?: string; transactionPrice?: number }) => ({
      name: t.name,
      transactionType: INSIDER_TRANSACTION_CODES[t.transactionCode ?? ""] ?? t.transactionCode ?? "Unknown",
      sharesChanged: t.change,
      sharesHeldAfter: t.share,
      transactionDate: t.transactionDate,
      pricePerShare: t.transactionPrice || null,
    }));

  const rawSentiment = Array.isArray(sentimentData.data) ? sentimentData.data : [];
  const monthlySentiment = rawSentiment
    .slice(-6)
    .map((s: { year?: number; month?: number; change?: number; mspr?: number }) => ({
      year: s.year,
      month: s.month,
      netSharesChanged: s.change,
      // MSPR (Monthly Share Purchase Ratio): -100 to +100. Positive means insiders
      // net bought that month, negative means they net sold.
      monthlySharePurchaseRatio: s.mspr,
    }));

  return {
    symbol,
    recentTransactions: transactions,
    monthlySentiment,
    note: "transactionType 'Open market purchase' and 'Open market sale' are the clearest buy/sell signals; other types (grants, tax withholding, option exercises) are routine compensation activity, not conviction bets.",
  };
}

async function getEarningsHistory(symbol: string) {
  const data = await finnhubGet("/stock/earnings", { symbol });
  if (data.error) return data;
  if (!Array.isArray(data) || data.length === 0) {
    return { error: `No earnings history found for "${symbol}".` };
  }
  return data.slice(0, 6).map((e: { period?: string; year?: number; quarter?: number; estimate?: number; actual?: number; surprise?: number; surprisePercent?: number }) => ({
    period: e.period,
    year: e.year,
    quarter: e.quarter,
    epsEstimate: e.estimate,
    epsActual: e.actual,
    surprise: e.surprise,
    surprisePercent: e.surprisePercent,
  }));
}

async function getMarketNews() {
  const data = await finnhubGet("/news", { category: "general" });
  if (data.error) return data;
  if (!Array.isArray(data)) return { error: "No market news available." };
  return data.slice(0, 8).map((item: { headline?: string; summary?: string; source?: string; datetime?: number }) => ({
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    date: new Date((item.datetime ?? 0) * 1000).toISOString().split("T")[0],
  }));
}

function extractStatementLines(
  lines: Array<{ concept?: string; label?: string; value?: unknown; unit?: string }> | undefined
) {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l) => typeof l.value === "number" && typeof l.label === "string")
    .slice(0, 15)
    .map((l) => ({ label: l.label, value: l.value }));
}

async function getFinancialStatements(symbol: string) {
  const data = await finnhubGet("/stock/financials-reported", { symbol, freq: "quarterly" });
  if (data.error) return data;

  const reports = Array.isArray(data.data) ? data.data : [];
  if (reports.length === 0) {
    return { error: `No reported financial statements found for "${symbol}".` };
  }

  const latest = reports[0];
  return {
    symbol,
    form: latest.form,
    fiscalYear: latest.year,
    fiscalQuarter: latest.quarter,
    periodEnd: latest.endDate,
    filedDate: latest.filedDate,
    balanceSheet: extractStatementLines(latest.report?.bs),
    incomeStatement: extractStatementLines(latest.report?.ic),
    cashFlow: extractStatementLines(latest.report?.cf),
    note: "Real line items as reported to the SEC (values in the filing's stated unit, typically USD). Not every company uses identical labels for the same concept - read labels carefully rather than assuming a fixed position means a fixed metric.",
  };
}

const MARKET_INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow Jones" },
  { symbol: "IWM", label: "Russell 2000" },
];

function isUsMarketOpen(): boolean {
  const nowEt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = nowEt.getDay();
  const minutes = nowEt.getHours() * 60 + nowEt.getMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

async function getMarketOverview() {
  const indices = await Promise.all(
    MARKET_INDEX_PROXIES.map(async ({ symbol, label }) => ({
      label,
      ...(await getStockQuote(symbol)),
    }))
  );
  return { usMarketOpen: isUsMarketOpen(), indices };
}

async function analyzePortfolio(cash: number, holdings: HoldingInput[]) {
  const validHoldings = holdings.filter((holding): holding is HoldingInput => {
    if (!holding || typeof holding !== "object") return false;
    const symbol = typeof holding.symbol === "string" ? holding.symbol.trim().toUpperCase() : "";
    const shares = typeof holding.shares === "number" ? holding.shares : Number.NaN;
    const avgCost = typeof holding.avgCost === "number" ? holding.avgCost : Number.NaN;

    return (
      symbol.length > 0 &&
      Number.isFinite(shares) &&
      shares > 0 &&
      Number.isFinite(avgCost) &&
      avgCost >= 0
    );
  }).map((holding) => ({
    ...holding,
    symbol: holding.symbol.trim().toUpperCase(),
  }));

  if (validHoldings.length === 0) {
    return {
      cash,
      totalValue: cash,
      cashAllocationPercent: 100,
      positions: [],
      note: "No open positions. 100% of the portfolio is in cash.",
      positionCount: 0,
    };
  }

  const priced = await Promise.all(
    validHoldings.map(async (h) => {
      const [quote, profile] = await Promise.all([
        getStockQuote(h.symbol),
        getCompanyProfile(h.symbol),
      ]);
      const price = "price" in quote ? (quote.price as number) : null;
      const marketValue = price != null ? price * h.shares : null;
      const sector = "industry" in profile ? (profile.industry as string) || "Unknown" : "Unknown";
      return {
        symbol: h.symbol,
        shares: h.shares,
        avgCost: h.avgCost,
        currentPrice: price,
        marketValue,
        sector,
        unrealizedGainLoss: price != null ? (price - h.avgCost) * h.shares : null,
        unrealizedGainLossPercent:
          price != null && h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : null,
      };
    })
  );

  const holdingsValue = priced.reduce((sum, p) => sum + (p.marketValue ?? 0), 0);
  const totalValue = cash + holdingsValue;

  const positions = priced.map((p) => ({
    ...p,
    portfolioWeightPercent:
      totalValue > 0 && p.marketValue != null ? (p.marketValue / totalValue) * 100 : null,
  }));

  const largestPosition = [...positions].sort(
    (a, b) => (b.portfolioWeightPercent ?? 0) - (a.portfolioWeightPercent ?? 0)
  )[0];

  const concentrationWarning =
    largestPosition && (largestPosition.portfolioWeightPercent ?? 0) > 25
      ? `${largestPosition.symbol} makes up ${largestPosition.portfolioWeightPercent!.toFixed(1)}% of the portfolio, which is a concentrated position.`
      : null;

  const sectorTotals = new Map<string, number>();
  for (const p of positions) {
    sectorTotals.set(p.sector, (sectorTotals.get(p.sector) ?? 0) + (p.marketValue ?? 0));
  }
  const sectorAllocation = Array.from(sectorTotals.entries())
    .map(([sector, value]) => ({
      sector,
      weightPercent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.weightPercent - a.weightPercent);

  const largestSector = sectorAllocation[0];
  const sectorConcentrationWarning =
    largestSector && sectorAllocation.length > 1 && largestSector.weightPercent > 40
      ? `${largestSector.sector} makes up ${largestSector.weightPercent.toFixed(1)}% of invested assets - the portfolio is concentrated in one sector.`
      : null;

  return {
    cash,
    totalValue,
    cashAllocationPercent: totalValue > 0 ? (cash / totalValue) * 100 : 100,
    positionCount: validHoldings.length,
    positions,
    concentrationWarning,
    sectorAllocation,
    sectorConcentrationWarning,
  };
}

function isValidRawTrade(
  t: unknown
): t is { symbol: string; action: "BUY" | "SELL"; shares: number; rationale?: unknown } {
  if (!t || typeof t !== "object") return false;
  const r = t as Record<string, unknown>;
  return (
    typeof r.symbol === "string" &&
    r.symbol.trim().length > 0 &&
    (r.action === "BUY" || r.action === "SELL") &&
    typeof r.shares === "number" &&
    r.shares > 0
  );
}

function proposeTrades(args: unknown): {
  result: Record<string, unknown>;
  proposal: { trades: ProposedTrade[]; summary: string } | null;
} {
  const a = (args ?? {}) as { trades?: unknown; summary?: unknown };
  const rawTrades = Array.isArray(a.trades) ? a.trades : [];
  const trades: ProposedTrade[] = rawTrades.filter(isValidRawTrade).map((t) => ({
    symbol: t.symbol.trim().toUpperCase(),
    action: t.action,
    shares: t.shares,
    rationale: typeof t.rationale === "string" ? t.rationale : "",
  }));

  if (trades.length === 0) {
    return {
      result: {
        error:
          "No valid trades provided. Each trade needs a symbol, action (BUY or SELL), and a positive share count.",
      },
      proposal: null,
    };
  }

  const summary = typeof a.summary === "string" ? a.summary : "";
  return {
    result: {
      trades,
      summary,
      note: "Displayed to the user as a pending plan. Nothing has executed yet — the user must click Execute Plan themselves.",
    },
    proposal: { trades, summary },
  };
}

const TOOLS = [
  {
    name: "get_stock_quote",
    description: "Get the current live price, today's change, and day range for a stock OR a supported cryptocurrency. Also works for major crypto tickers directly (e.g. BTC, ETH, SOL) - do not substitute a proxy security like GBTC when the user asks about a crypto asset directly; call this tool with the crypto ticker itself first.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol (e.g. AAPL, NVDA) or crypto ticker (e.g. BTC, ETH, SOL)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_stock_news",
    description: "Get recent news headlines and summaries for a specific company, from the last 7 days.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol, e.g. AAPL, NVDA, TSLA" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "search_symbol",
    description:
      "Look up the ticker symbol for a company by name. Use this whenever the user mentions a company by name rather than its ticker, instead of guessing the symbol.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Company name or partial name, e.g. 'apple' or 'nvidia'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_company_profile",
    description: "Get basic company info: name, sector/industry, exchange, country, market cap.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_company_fundamentals",
    description:
      "Get key valuation and fundamental metrics for a stock: P/E ratio, EPS, market cap, 52-week high/low, dividend yield, beta.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_peer_comparison",
    description:
      "Get live quotes for a stock and a handful of its closest industry peers, for side-by-side comparison.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_analyst_ratings",
    description:
      "Get recent analyst buy/hold/sell recommendation trends and price targets (high/low/mean/median) for a stock.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_earnings_calendar",
    description: "Get the next upcoming earnings report date(s) and EPS/revenue estimates for a stock.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_market_overview",
    description:
      "Get a snapshot of overall market conditions: major US index ETFs (S&P 500, Nasdaq 100, Dow, Russell 2000) and whether the US market is currently open.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_insider_activity",
    description:
      "Get recent insider (executive/director) buy/sell transactions and monthly insider sentiment (MSPR) for a stock. Use this to gauge whether the people who run the company are net buying or net selling their own stock - a real signal a professional analyst checks, not something to estimate.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_earnings_history",
    description:
      "Get the last several quarters of actual EPS vs analyst estimate, including the surprise and surprise percent. Use this to assess whether a company has a track record of beating or missing expectations, not just what's estimated next.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_financial_statements",
    description:
      "Get real, as-reported line items from the company's most recent quarterly SEC filing: balance sheet, income statement, and cash flow statement. Use this for genuine fundamental analysis (revenue, margins, debt load, cash generation) rather than relying only on summary ratios.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_market_news",
    description:
      "Get current general market and macroeconomic news headlines, not tied to a single company. Use this when the user asks about overall market conditions, sentiment, or 'what's going on' rather than one stock.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "analyze_portfolio",
    description:
      "Compute real, current numbers for the user's actual portfolio: live market value of each holding, unrealized gain/loss, cash allocation percentage, sector allocation, and concentration risk (both single-position and single-sector). Always use this instead of estimating portfolio numbers yourself.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "propose_trades",
    description:
      "Propose one or more trades for the user to review. This does NOT execute anything - it displays a Trade Plan the user must explicitly review and run themselves by clicking Execute Plan. Use this whenever the user asks you to buy, sell, or build/adjust a portfolio. You may call it again to replace the plan as the user refines their request. Always check get_stock_quote for current prices and analyze_portfolio for available cash before proposing, so the plan is realistic.",
    parameters: {
      type: "object",
      properties: {
        trades: {
          type: "array",
          items: {
            type: "object",
            properties: {
              symbol: { type: "string" },
              action: { type: "string", enum: ["BUY", "SELL"] },
              shares: { type: "number" },
              rationale: { type: "string", description: "One sentence on why this trade is part of the plan" },
            },
            required: ["symbol", "action", "shares", "rationale"],
          },
        },
        summary: { type: "string", description: "One or two sentence summary of the overall plan or strategy" },
      },
      required: ["trades", "summary"],
    },
  },
];

// "gemini-flash-latest" resolves to Google's newest flagship "thinking" model
// (gemini-3.7-flash as of writing), which burns 80-230 hidden "thought" tokens
// per call and is frequently 503 UNAVAILABLE under free-tier demand. The
// "-lite-latest" alias stays on Google's lightweight tier by design (no
// thinking overhead, much higher free-tier headroom) and tests reliably at
// 14/14 requests vs ~60% for the flagship alias - same free API key, no new
// provider needed.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini's free tier can still return the occasional 503/429 under load - these
// are worth a few short retries before giving up, rather than failing the
// whole chat turn on the first blip.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [600, 1500, 3000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel(
  contents: GeminiContent[],
  systemInstruction: string,
  apiKey: string,
  includeTools = true
) {
  let lastErrorMessage = "Gemini request failed.";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController();
    // Structured, multi-section analyst answers can genuinely take longer to
    // generate than a quick lookup - 8s was aborting legitimately-in-progress
    // generations, which then retried and aborted again, cascading across
    // tool-calling rounds into a near-permanent hang. 25s gives real answers
    // room to finish without waiting so long a user thinks it's broken.
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          ...(includeTools ? { tools: [{ functionDeclarations: TOOLS }] } : {}),
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      });

      if (response.ok) {
        return response.json();
      }

      const errText = await response.text();
      let parsedMessage: string | null = null;
      try {
        const parsed = JSON.parse(errText);
        parsedMessage = parsed?.error?.message ?? null;
      } catch {
        parsedMessage = null;
      }
      lastErrorMessage = parsedMessage
        ? `Gemini error (${response.status}): ${parsedMessage}`
        : `Gemini request failed (${response.status}): ${errText}`;

      const canRetry = RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length;
      if (!canRetry) {
        if (response.status === 503 || response.status === 429) {
          throw new Error(
            "The AI model is temporarily overloaded (Gemini's free tier can get busy). Please try again in a moment."
          );
        }
        throw new Error(lastErrorMessage);
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastErrorMessage = "Gemini request timed out after 8 seconds.";
      } else if (error instanceof Error) {
        lastErrorMessage = error.message;
      } else {
        lastErrorMessage = "Gemini request failed.";
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw new Error(lastErrorMessage);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastErrorMessage);
}

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  cash: number,
  holdings: HoldingInput[]
): Promise<{ result: unknown; proposal: { trades: ProposedTrade[]; summary: string } | null }> {
  const symbol = () => String(args.symbol ?? "");

  switch (name) {
    case "get_stock_quote":
      return { result: await getStockQuote(symbol()), proposal: null };
    case "get_stock_news":
      return { result: await getStockNews(symbol()), proposal: null };
    case "search_symbol":
      return { result: await searchSymbol(String(args.query ?? "")), proposal: null };
    case "get_company_profile":
      return { result: await getCompanyProfile(symbol()), proposal: null };
    case "get_company_fundamentals":
      return { result: await getCompanyFundamentals(symbol()), proposal: null };
    case "get_peer_comparison":
      return { result: await getPeerComparison(symbol()), proposal: null };
    case "get_analyst_ratings":
      return { result: await getAnalystRatings(symbol()), proposal: null };
    case "get_earnings_calendar":
      return { result: await getEarningsCalendar(symbol()), proposal: null };
    case "get_market_overview":
      return { result: await getMarketOverview(), proposal: null };
    case "get_insider_activity":
      return { result: await getInsiderActivity(symbol()), proposal: null };
    case "get_earnings_history":
      return { result: await getEarningsHistory(symbol()), proposal: null };
    case "get_financial_statements":
      return { result: await getFinancialStatements(symbol()), proposal: null };
    case "get_market_news":
      return { result: await getMarketNews(), proposal: null };
    case "analyze_portfolio":
      return { result: await analyzePortfolio(cash, holdings), proposal: null };
    case "propose_trades":
      return proposeTrades(args);
    default:
      return { result: { error: "Unknown tool" }, proposal: null };
  }
}

const COOLDOWN_MS = 2000;
const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: NextRequest) {
  const email = await getAuthedEmail();
  const cooldownKey = getCooldownKey(request, email);
  const allowed = await checkCooldown("chat", cooldownKey, COOLDOWN_MS);

  if (!allowed) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another message." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  let body: {
    messages?: unknown;
    portfolioContext?: unknown;
    cash?: unknown;
    holdings?: unknown;
    tutorialMode?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const incomingMessages: ChatMessage[] = ((Array.isArray(body.messages) ? body.messages : []) as unknown[])
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((msg): msg is ChatMessage => !!msg && typeof msg === "object" && typeof (msg as { role?: unknown }).role === "string" && typeof (msg as { content?: unknown }).content === "string");
  const portfolioContext: string = typeof body.portfolioContext === "string" ? body.portfolioContext : "";
  const cash: number = typeof body.cash === "number" && Number.isFinite(body.cash) ? body.cash : 0;
  const holdings: HoldingInput[] = Array.isArray(body.holdings)
    ? (body.holdings as unknown[]).filter((item): item is HoldingInput => {
        if (!item || typeof item !== "object") return false;
        const maybe = item as Partial<HoldingInput>;
        return (
          typeof maybe.symbol === "string" &&
          Number.isFinite(maybe.shares) &&
          Number.isFinite(maybe.avgCost)
        );
      })
    : [];
  const tutorialMode: boolean = body.tutorialMode === true;

  const systemInstruction = `You are Krix, the research and trading assistant inside a paper trading app called AI Paper Trader. If asked your name, you are Krix. The user is practicing investing with fake money.

Operate at the level of a senior equity research analyst at a top-tier investment bank (Goldman Sachs caliber) - rigorous, quantitative, structured, and precise. That means:
- Ground every claim in real data pulled from tools, never from memory or estimation. If a tool returns an error or no data, say so plainly rather than guessing or filling the gap.
- Reason in the vocabulary of professional equity research: revenue growth, margins, valuation multiples, earnings surprises, insider conviction, sector concentration, risk-adjusted position sizing. Don't dumb this down by default - the user is here to learn how professionals actually think, not get a simplified gloss. Define a term in one clause the first time you use it if it's genuinely obscure, then keep moving.
- When asked for a real opinion or analysis on a stock (not just a quick quote lookup), do the analyst's job properly: pull multiple angles before concluding - current valuation (get_company_fundamentals), the real financial statements (get_financial_statements), whether the company beats or misses expectations (get_earnings_history), what insiders are doing with their own money (get_insider_activity), how it stacks against peers (get_peer_comparison), what the Street thinks (get_analyst_ratings), and recent developments (get_stock_news). Then synthesize - don't just dump tool output. Structure a real stock opinion as: Thesis (one or two sentences), Valuation, Catalysts, Key risks. Skip any section that genuinely has nothing to say, but don't skip sections to save effort.
- For portfolio-level questions, think like a portfolio manager, not just a bookkeeper: call analyze_portfolio for real numbers (it includes sector allocation and concentration flags), and proactively surface concentration or diversification risk even if the user didn't ask about it directly - that's what a good analyst does.
- If the user names a company rather than a ticker, call search_symbol first to confirm the correct symbol before looking anything else up.
- Data can be delayed or the market may be closed; call get_market_overview or get_market_news if broader market context matters to the answer.
- When comparing multiple stocks or metrics, format the comparison as a markdown table.
- Be concise for simple factual lookups (a quote, a single number). Give real depth - not padding, substance - when the user is asking for analysis or a judgment call. Don't confuse "concise" with "shallow."
- You are not a licensed financial advisor. Unsolicited opinions should stay educational, not prescriptive - frame them as "here's how a professional would size this up," not personalized advice. But if the user explicitly asks you to buy, sell, or build/adjust their portfolio, that is a direct instruction you should act on using propose_trades - don't deflect with "I can't give financial advice" when they've asked you to act, not just to opine.
- propose_trades never executes a trade by itself - it only shows the user a plan they must click "Execute Plan" to run. Never tell the user a trade has completed unless they tell you they clicked Execute and you're reacting to that. Before proposing, call get_stock_quote for current prices and analyze_portfolio for available cash so the plan is realistic (doesn't spend more cash than they have, doesn't sell more shares than they own), and let the depth of research above inform which trades you propose and why.
${
  tutorialMode
    ? `\nThe user has asked for a guided walkthrough of placing their first trade. Explain briefly what a market order is, ask one question about what kind of company interests them (or suggest a well-known, stable stock if they don't have a preference), then call propose_trades with exactly ONE small trade (a handful of shares). End by telling them to review the plan and click "Execute Plan" when ready - that click is part of the lesson, so don't rush past it.\n`
    : ""
}
Reference portfolio summary (approximate; call analyze_portfolio for precise, current figures):
${portfolioContext}`;

  const contents: GeminiContent[] = incomingMessages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  while (contents[0]?.role === "model") {
    contents.shift();
  }

  try {
    let replyText = "";
    let proposedTrades: { trades: ProposedTrade[]; summary: string } | null = null;
    let rounds = 0;

    // 3, not 6 - measured empirically, not guessed. Six real test questions
    // spanning simple lookups through the full 7-tool analyst research
    // protocol (see the system prompt's "real stock opinion" instructions)
    // topped out at 3 rounds every time, because Gemini batches independent
    // tool calls into one round rather than spacing them out - a
    // 7-tool deep-dive question landed in a single round, not seven. The
    // only cases that reach 3 are genuinely sequential ones (propose_trades
    // needs quotes and cash back first), not research depth. Halving this
    // roughly doubles how many concurrent users fit in Gemini's free-tier
    // 15 RPM ceiling, since each round is its own request.
    while (rounds < 3) {
      const data = await callModel(contents, systemInstruction, apiKey);
      const candidateContent = data.candidates?.[0]?.content;
      const parts: GeminiPart[] = candidateContent?.parts ?? [];
      const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
      const textParts = parts.filter((p) => p.text).map((p) => p.text ?? "");
      const candidateText = textParts.join("");

      if (functionCalls.length === 0) {
        replyText = candidateText || replyText;
        break;
      }

      contents.push({ role: "model", parts });

      const responseParts: GeminiPart[] = [];
      for (const call of functionCalls) {
        const { result, proposal } = await dispatchTool(call.name, call.args ?? {}, cash, holdings);
        if (proposal) proposedTrades = proposal;
        responseParts.push({
          functionResponse: {
            name: call.name,
            ...(call.id ? { id: call.id } : {}),
            response: { result },
          },
        });
      }
      contents.push({ role: "user", parts: responseParts });

      rounds++;

      if (rounds >= 3) {
        const followUp = await callModel(contents, systemInstruction, apiKey, false);
        const followUpParts: GeminiPart[] = followUp.candidates?.[0]?.content?.parts ?? [];
        const followUpText = followUpParts
          .filter((p) => p.text)
          .map((p) => p.text ?? "")
          .join("");
        replyText = followUpText || candidateText || "No response generated.";
        break;
      }
    }

    if (!replyText) replyText = "No response generated.";
    return NextResponse.json({ reply: replyText, proposedTrades });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Gemini API" },
      { status: 500 }
    );
  }
}
