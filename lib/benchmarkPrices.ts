import { createAdminClient } from "@/lib/supabase/admin";

const TWELVE_DATA_SYMBOL = "SPY";

// Confirmed empirically against our actual Twelve Data key before building
// this: outputsize=5000 in a single request returns 5000 daily bars
// (spanning back to 2006) for 1 API credit. The basic-plan limits are 8
// credits/minute and 800/day (from that same key's /api_usage response) -
// depth was never the constraint. A year-old account's cold-start backfill
// costs exactly one request, same as a same-day account's.
const MAX_OUTPUTSIZE = 5000;

// Trading days are ~5 of every 7 calendar days. This is only used to size
// the outputsize request generously enough to cover a gap - not a
// timezone-sensitive date match like benchmark_trading_date, so plain UTC
// day math is fine here.
const TRADING_DAYS_PER_CALENDAR_DAY = 5 / 7;
const OUTPUTSIZE_BUFFER = 10; // headroom for holidays on top of the weekend adjustment

function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function estimateOutputsize(calendarDaysBack: number): number {
  return Math.min(
    Math.ceil(calendarDaysBack / TRADING_DAYS_PER_CALENDAR_DAY) + OUTPUTSIZE_BUFFER,
    MAX_OUTPUTSIZE
  );
}

/**
 * Incrementally brings benchmark_prices up to date from Twelve Data.
 * A no-op once already current for today (checked via max(date)) - this is
 * the "no cron" trigger: callers just call this before reading, and at
 * most one real Twelve Data request happens per calendar day no matter how
 * many times it's called.
 *
 * Uses the service-role client for both the read and the write. The write
 * requires it (benchmark_prices' RLS blocks every other role). The read
 * does too on a cold start: sizing the initial backfill needs
 * min(portfolios.benchmark_start_date) across every user's portfolio, which
 * a normal RLS-scoped client could never see beyond its own row.
 *
 * Best-effort by design: throws here are expected to be caught by the
 * caller, which falls through to whatever's already stored rather than
 * failing the whole request. See app/api/benchmark/route.ts's staleness
 * check for how a fetch that keeps failing eventually surfaces as
 * "benchmark unavailable" instead of silently serving a stale number
 * forever.
 */
export async function ensureBenchmarkPricesUpToDate(): Promise<void> {
  const admin = createAdminClient();
  const today = new Date();

  const { data: latest } = await admin
    .from("benchmark_prices")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let outputsize: number;

  if (!latest) {
    const { data: earliestPortfolio } = await admin
      .from("portfolios")
      .select("benchmark_start_date")
      .order("benchmark_start_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!earliestPortfolio) {
      // No portfolios exist yet - nothing to backfill for. A small default
      // still seeds the table so it isn't starting from zero rows the
      // moment the first portfolio shows up.
      outputsize = 30;
    } else {
      const calendarDaysBack = Math.max(
        calendarDaysBetween(new Date(earliestPortfolio.benchmark_start_date), today),
        0
      );
      outputsize = estimateOutputsize(calendarDaysBack);
    }
  } else {
    const calendarDaysBack = calendarDaysBetween(new Date(latest.date), today);
    if (calendarDaysBack <= 0) {
      return; // already caught up for today
    }
    outputsize = estimateOutputsize(calendarDaysBack);
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing TWELVE_DATA_API_KEY");
  }

  const response = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${TWELVE_DATA_SYMBOL}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Twelve Data request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.status === "error" || !Array.isArray(data.values)) {
    throw new Error(data.message ?? "Twelve Data returned no SPY data");
  }

  const rows = (data.values as { datetime: string; close: string }[])
    .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
    .filter((r) => Number.isFinite(r.close) && r.close > 0);

  if (rows.length === 0) return;

  // Upsert, not insert-and-ignore: a still-settling "today" bar fetched
  // mid-session and later revised should be corrected on the next run, not
  // permanently frozen at whatever value it first had.
  const { error } = await admin.from("benchmark_prices").upsert(rows, { onConflict: "date" });
  if (error) throw error;
}
