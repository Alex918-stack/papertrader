// ============================================================================
// Shared single-shot Gemini text completion
// ============================================================================
// Extracted from app/api/journal/critique/route.ts, unchanged behavior - that
// route and app/api/trading/draft-thesis/route.ts both need exactly the same
// shape (one prompt in, plain text out, a couple of retries on 429/503), and
// duplicating the retry/error-handling logic risked the two copies quietly
// drifting apart. app/api/chat/route.ts is NOT built on this - it needs
// multi-turn contents + tool declarations, a different shape entirely (see
// callModel there).

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Measured empirically, not assumed: a 30-concurrent-request burst against
// this exact endpoint/model returned 19 successes and 11 429s, each carrying
// "limit: 15" (requests/minute) and "Please retry in ~8.2s" in the error
// body. Two retries at that real observed window.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [9000, 9000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's 429 body includes its own "Please retry in X.Xs" - prefer that
// real signal over our fixed default when it's present.
function parseRetryAfterMs(errorMessage: string | null): number | null {
  const match = errorMessage?.match(/retry in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

/**
 * One prompt in, plain text out. Throws a user-presentable Error on failure
 * (already retried through transient 429/503s) - callers surface err.message
 * directly rather than wrapping it again.
 */
export async function callGeminiText(prompt: string, apiKey: string): Promise<string> {
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

/**
 * Strips a ```json ... ``` (or bare ```...```) fence if present, then
 * parses. Gemini reliably follows a "return only JSON" instruction for
 * short structured outputs, but not universally - defending against the
 * fence is cheap and avoids a brittle first-token check.
 */
export function parseJsonFromModelText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim()) as T;
}
