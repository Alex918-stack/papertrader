import { NextResponse } from "next/server";
import { createClient, getAuthedEmail } from "@/lib/supabase/server";
import { ensureBenchmarkPricesUpToDate } from "@/lib/benchmarkPrices";
import { STARTING_CASH } from "@/lib/constants";

// If the newest row we have is older than this, the populate mechanism is
// plainly not keeping up (a normal weekend + holiday never produces a gap
// this long) - show "unavailable" rather than a comparison built on a
// number that's quietly gone stale.
const STALE_AFTER_DAYS = 5;

export async function GET() {
  const email = await getAuthedEmail();
  if (!email) {
    return NextResponse.json({ status: "signed_out" });
  }

  const supabase = await createClient();

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("benchmark_start_date")
    .single();

  if (portfolioError || !portfolio) {
    return NextResponse.json({ status: "unavailable" });
  }

  // Best-effort refresh - a failure here just means we fall through to
  // whatever's already stored. Whether that's good enough to show is
  // decided below, from the data actually in benchmark_prices, not from
  // whether this particular refresh attempt happened to succeed.
  try {
    await ensureBenchmarkPricesUpToDate();
  } catch {
    // Ignored on purpose - see the comment above.
  }

  const { data: latest } = await supabase
    .from("benchmark_prices")
    .select("date, close")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return NextResponse.json({ status: "unavailable" });
  }

  const daysSinceLatest =
    (Date.now() - new Date(latest.date).getTime()) / (24 * 60 * 60 * 1000);
  if (daysSinceLatest > STALE_AFTER_DAYS) {
    return NextResponse.json({ status: "unavailable" });
  }

  // The one correct place this conversion happens - see
  // supabase/migrations/0006_benchmark_baseline.sql's comment on
  // benchmark_trading_date for why a plain JS date cast would be wrong here.
  const { data: resolvedDate, error: dateError } = await supabase.rpc(
    "benchmark_trading_date",
    { p_ts: portfolio.benchmark_start_date }
  );

  if (dateError || !resolvedDate) {
    return NextResponse.json({ status: "unavailable" });
  }

  const { data: start } = await supabase
    .from("benchmark_prices")
    .select("date, close")
    .gte("date", resolvedDate)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!start) {
    // benchmark_prices.date and resolvedDate are both plain `date` values
    // (YYYY-MM-DD), so string comparison is chronological comparison here -
    // no timestamp/timezone mismatch to worry about.
    if (resolvedDate > latest.date) {
      // Nothing has closed on or after the resolved start date yet - normal
      // for a signup or reset that lands on a weekend, a holiday, or simply
      // earlier today before market close. Time hasn't passed, the data
      // isn't broken.
      return NextResponse.json({
        status: "insufficient_history",
        benchmarkStartDate: resolvedDate,
      });
    }
    // resolvedDate is on or before our latest close, yet no row covers it -
    // a real gap inside otherwise-covered history, not just "time hasn't
    // passed yet." This should be unreachable given latest.date is the max
    // date in the table (any resolvedDate <= latest.date is covered by the
    // latest row itself), but it's handled explicitly rather than relying
    // on that invariant always holding.
    return NextResponse.json({ status: "unavailable" });
  }

  if (start.date === latest.date) {
    // Same trading day on both ends - there is no second data point yet to
    // compare against, only the one we started from. A 0% shown here would
    // be a display artifact, not a real "the market didn't move" fact.
    return NextResponse.json({
      status: "insufficient_history",
      benchmarkStartDate: start.date,
    });
  }

  const hypotheticalShares = STARTING_CASH / start.close;
  const benchmarkValue = hypotheticalShares * latest.close;
  const benchmarkReturnPct = ((benchmarkValue - STARTING_CASH) / STARTING_CASH) * 100;

  return NextResponse.json({
    status: "ok",
    benchmarkReturnPct,
    benchmarkStartDate: start.date,
    latestDate: latest.date,
    startingCash: STARTING_CASH,
  });
}
