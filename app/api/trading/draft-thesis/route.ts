import { NextRequest, NextResponse } from "next/server";
import { ALL_ASSETS } from "@/lib/stockSymbols";
import { getAuthedEmail } from "@/lib/supabase/server";
import { checkCooldown, getCooldownKey } from "@/lib/rateLimitCooldown";
import { getStockQuote, getStockNews } from "@/lib/finnhubClient";
import { callGeminiText, parseJsonFromModelText } from "@/lib/gemini";

// Same shared cooldown mechanism as chat/critique, own bucket - this is a
// separate Gemini call site sharing the same free-tier 15 RPM/1500-per-day
// budget, so it needs its own guard against a user mashing the button.
const COOLDOWN_MS = 3000;

const ASSET_BY_SYMBOL = new Map(ALL_ASSETS.map((a) => [a.symbol, a]));

interface DraftedThesis {
  whyThis: string;
  whyNow: string;
  invalidation: string;
  invalidationPrice: number | null;
}

function isDraftedThesisShape(value: unknown): value is DraftedThesis {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.whyThis === "string" &&
    typeof v.whyNow === "string" &&
    typeof v.invalidation === "string" &&
    (v.invalidationPrice === null || (typeof v.invalidationPrice === "number" && Number.isFinite(v.invalidationPrice)))
  );
}

function buildPrompt(
  symbol: string,
  companyName: string,
  description: string,
  quote: Record<string, unknown>,
  news: Record<string, unknown>[],
  contextHint: string | null
): string {
  const quoteBlock =
    "price" in quote && typeof quote.price === "number"
      ? `Current price: $${quote.price}. Today's change: ${quote.change} (${quote.changePercent}%). Day range: $${quote.dayLow}-$${quote.dayHigh}.`
      : "Live quote unavailable right now - draft in general terms rather than citing a specific price.";

  const newsBlock =
    news.length > 0
      ? news.map((n) => `- ${n.headline} (${n.source}, ${n.date})`).join("\n")
      : "No recent news available - do not invent any.";

  const hintBlock = contextHint
    ? `\nThis trade idea originally came from this reasoning, which you may draw on: "${contextHint}"\n`
    : "";

  return `You are Krix, drafting a first-pass trading thesis for a user who is about to open a new position in ${symbol} (${companyName}). ${description}

You are drafting ON BEHALF of the user - they will review, edit, and confirm every field themselves before anything executes. Never claim certainty you don't have; keep every claim grounded in the data below.

${quoteBlock}

Recent news (last 7 days):
${newsBlock}
${hintBlock}
Return ONLY a JSON object, no markdown code fences, no extra commentary, with exactly these keys:
{
  "whyThis": "1-2 plain sentences: the case for this stock right now, grounded only in the data above",
  "whyNow": "1-2 plain sentences: why today specifically, not last week or next",
  "invalidation": "1 plain sentence: the condition that would prove this thesis wrong",
  "invalidationPrice": a plausible number below the current price representing that invalidation level, or null if the invalidation isn't naturally price-based (e.g. it depends on an earnings result or a news event instead)
}

Do not invent specific numbers, events, or news that aren't in the data provided above - if the data is thin, keep the thesis general rather than fabricating detail.`;
}

export async function POST(request: NextRequest) {
  let body: { symbol?: unknown; contextHint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }
  const contextHint = typeof body.contextHint === "string" && body.contextHint.trim() ? body.contextHint.trim() : null;

  const email = await getAuthedEmail();
  const cooldownKey = getCooldownKey(request, email);
  const allowed = await checkCooldown("draft-thesis", cooldownKey, COOLDOWN_MS);
  if (!allowed) {
    return NextResponse.json({ error: "Please wait a moment before drafting again." }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }

  const asset = ASSET_BY_SYMBOL.get(symbol);
  const companyName = asset?.name ?? symbol;
  const description = asset?.description ?? "";

  // Best-effort: a thesis draft is still useful with thinner grounding, so a
  // quote or news failure degrades the prompt rather than failing the
  // request outright - same "a real number that's a bit off beats no
  // number" stance the rest of this app takes toward imperfect data.
  const [quoteResult, newsResult] = await Promise.allSettled([getStockQuote(symbol), getStockNews(symbol)]);
  const quote = quoteResult.status === "fulfilled" && !("error" in quoteResult.value) ? quoteResult.value : {};
  const news = newsResult.status === "fulfilled" && Array.isArray(newsResult.value) ? newsResult.value : [];

  const prompt = buildPrompt(symbol, companyName, description, quote, news, contextHint);

  let modelText: string;
  try {
    modelText = await callGeminiText(prompt, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Gemini" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = parseJsonFromModelText(modelText);
  } catch {
    return NextResponse.json({ error: "Krix's draft came back in an unexpected format - try again." }, { status: 502 });
  }

  if (!isDraftedThesisShape(parsed)) {
    return NextResponse.json({ error: "Krix's draft came back in an unexpected format - try again." }, { status: 502 });
  }

  return NextResponse.json({
    whyThis: parsed.whyThis.trim(),
    whyNow: parsed.whyNow.trim(),
    invalidation: parsed.invalidation.trim(),
    invalidationPrice: parsed.invalidationPrice !== null && parsed.invalidationPrice > 0 ? parsed.invalidationPrice : null,
  });
}
