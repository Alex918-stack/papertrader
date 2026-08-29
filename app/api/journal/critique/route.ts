import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthedEmail } from "@/lib/supabase/server";
import { checkCooldown, getCooldownKey } from "@/lib/rateLimitCooldown";

// Every position close fires this route (fire-and-forget from
// PortfolioContext.trade()), and it's also reachable on demand from the
// journal page's retry button - a fast enough sequence of closes or
// retries would otherwise mean an unbounded run of Gemini calls per user.
// Same shared mechanism as the chat cooldown (lib/rateLimitCooldown.ts),
// different bucket.
const COOLDOWN_MS = 3000;

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Measured empirically, not assumed: a 30-concurrent-request burst against
// this exact endpoint/model returned 19 successes and 11 429s, each
// carrying "limit: 15" (requests/minute) and "Please retry in ~8.2s" in the
// error body. Two retries at that real observed window, not chat/route.ts's
// shorter 600/1500/3000ms ladder (tuned for a different quota shape) - a
// demo-scale burst against a 15 RPM ceiling needs to wait out the window,
// not just back off briefly.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [9000, 9000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's 429 body includes its own "Please retry in X.Xs" - prefer that
// real signal over our fixed default when it's present, same "read the
// actual signal, don't just guess" instinct this app applies everywhere
// else (see e.g. ensureDailyPricesDeepCoverage's lease-based retry).
function parseRetryAfterMs(errorMessage: string | null): number | null {
  const match = errorMessage?.match(/retry in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let lastErrorMessage = "Gemini request failed.";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let response: Response;
    try {
      response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
    } catch {
      throw new Error("Failed to reach Gemini");
    }

    if (response.ok) {
      const data = await response.json();
      const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? "").join("");
      if (!text.trim()) throw new Error("Gemini returned an empty response");
      return text;
    }

    const body = await response.json().catch(() => null);
    const apiMessage: string | null = body?.error?.message ?? null;
    lastErrorMessage = apiMessage
      ? `Gemini error (${response.status}): ${apiMessage}`
      : `Gemini request failed (${response.status})`;

    const canRetry = RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length;
    if (!canRetry) {
      throw new Error(
        response.status === 429 || response.status === 503
          ? "The AI model is temporarily overloaded (Gemini's free tier can get busy). Please try again in a moment."
          : lastErrorMessage
      );
    }

    await sleep(parseRetryAfterMs(apiMessage) ?? RETRY_DELAYS_MS[attempt]);
  }

  throw new Error(lastErrorMessage);
}

interface EpisodeTransaction {
  type: string;
  shares: number;
  price: number;
  total: number;
  executed_at: string;
}

interface EpisodeRow {
  symbol: string;
  opened_at: string;
  closed_at: string;
  thesis_why_this: string | null;
  thesis_why_now: string | null;
  thesis_invalidation: string | null;
  thesis_invalidation_price: number | null;
}

function buildPrompt(episode: EpisodeRow, transactions: EpisodeTransaction[]): string {
  const buysCost = transactions.filter((t) => t.type === "buy").reduce((sum, t) => sum + t.total, 0);
  const sellProceeds = transactions.filter((t) => t.type === "sell").reduce((sum, t) => sum + t.total, 0);
  const pnl = sellProceeds - buysCost;
  const pnlPercent = buysCost > 0 ? (pnl / buysCost) * 100 : 0;

  const tradeLines = transactions
    .map(
      (t) =>
        `${t.type.toUpperCase()} ${t.shares} shares @ $${t.price.toFixed(2)} on ${new Date(t.executed_at).toISOString().slice(0, 10)}`
    )
    .join("\n");

  // Deliberately not referencing exit_reflection: the critique is generated
  // the moment the episode closes (see PortfolioContext.trade()), before the
  // user has necessarily given their own reflection, which is a separate,
  // later, optional action. Nothing here can depend on data that doesn't
  // exist yet at generation time.
  const thesisBlock = episode.thesis_why_this
    ? `Stated thesis:
- Why this: ${episode.thesis_why_this}
- Why now: ${episode.thesis_why_now}
- What would prove it wrong: ${episode.thesis_invalidation}${
        episode.thesis_invalidation_price != null
          ? `\n- Invalidation price: $${episode.thesis_invalidation_price}`
          : ""
      }`
    : "No thesis was written when this position was opened.";

  return `You are Krix, critiquing a paper-trading position for the user who just closed it. Be direct, specific, and grounded in the actual numbers - this is a coaching moment, not encouragement or flattery.

Symbol: ${episode.symbol}
Opened: ${new Date(episode.opened_at).toISOString().slice(0, 10)}
Closed: ${new Date(episode.closed_at).toISOString().slice(0, 10)}

${thesisBlock}

Trades in this position:
${tradeLines}

Realized P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%)

Write a short critique, 2-4 sentences, plain prose, no headers or bullet points. If a thesis was written, assess whether the exit lines up with the stated invalidation - was it sold near the stated invalidation price, well before the thesis was actually tested, or well past the point where the thesis had already failed? Be concrete with the numbers, not vague. If no thesis was written, say so plainly and note that writing one next time would make this feedback worth more - don't invent a thesis that wasn't there. Don't moralize or lecture; write like a sharp, honest research partner, not a motivational coach. Only assert what's actually observable in the prices, dates, and stated thesis - never state the user's motive (e.g. that they panicked, grew impatient, or lost conviction) as a fact, since you can't observe that. When motive is worth raising, pose it as a direct question instead of a verdict - e.g. "You exited before your thesis had a single session to play out - what changed?" - so the critique stays pointed without claiming to know something it doesn't.`;
}

// Generates Krix's critique for a just-closed episode and writes it once.
// Called two ways: fire-and-forget right after PortfolioContext.trade()
// detects a position closed, and on-demand from the journal page's retry
// button for episodes where that first attempt never landed (a network
// blip, or an episode that closed before this route existed). Both paths
// are safe to call repeatedly - if critique is already set, this is a
// no-op, and the write-once trigger on position_episodes would reject a
// second write even if it weren't.
export async function POST(request: NextRequest) {
  let body: { episodeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const episodeId = typeof body.episodeId === "string" ? body.episodeId : null;
  if (!episodeId) {
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
  }

  const email = await getAuthedEmail();
  const cooldownKey = getCooldownKey(request, email);
  const allowed = await checkCooldown("critique", cooldownKey, COOLDOWN_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Please wait a moment before requesting another critique." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }

  const supabase = await createClient();

  // No separate ownership check needed - RLS already scopes this to the
  // calling user's own episodes. If the id doesn't exist, or belongs to
  // someone else, or the caller isn't signed in at all, this simply comes
  // back empty, and "not found" is the correct, safe response for all three.
  const { data: episode, error: episodeError } = await supabase
    .from("position_episodes")
    .select(
      "symbol, opened_at, closed_at, thesis_why_this, thesis_why_now, thesis_invalidation, thesis_invalidation_price, critique"
    )
    .eq("id", episodeId)
    .maybeSingle();

  if (episodeError || !episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  if (!episode.closed_at) {
    return NextResponse.json({ error: "Episode is not closed yet" }, { status: 400 });
  }
  if (episode.critique) {
    return NextResponse.json({ critique: episode.critique, alreadyGenerated: true });
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, shares, price, total, executed_at")
    .eq("episode_id", episodeId)
    .order("executed_at", { ascending: true });

  const prompt = buildPrompt(
    { ...episode, closed_at: episode.closed_at },
    (transactions ?? []).map((t) => ({
      type: t.type,
      shares: Number(t.shares),
      price: Number(t.price),
      total: Number(t.total),
      executed_at: t.executed_at,
    }))
  );

  let critiqueText: string;
  try {
    critiqueText = await callGemini(prompt, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Gemini" },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabase
    .from("position_episodes")
    .update({ critique: critiqueText, critique_generated_at: new Date().toISOString() })
    .eq("id", episodeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ critique: critiqueText });
}
