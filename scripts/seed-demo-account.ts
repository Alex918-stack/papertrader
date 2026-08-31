// ============================================================================
// Demo account seeder
// ============================================================================
// Populates ONE dedicated demo account (targeted by email, required) with
// backdated trading history spanning ~3-4 real months, so every panel on
// /journal/scorecard, /journal, and /portfolio renders a real value instead
// of a "not enough data yet" gate.
//
// Why direct inserts instead of calling execute_trade/record_exit_reflection:
// execute_trade hardcodes opened_at/closed_at/executed_at to now() with no
// parameter to backdate any of them, and closed_at is protected by a
// write-once trigger (position_episodes_review_fields_write_once) that
// rejects ANY update to it once set, for every role including service_role
// (triggers aren't affected by RLS bypass). So there is no way to call the
// real RPC and then backdate the result. This script instead writes directly
// to holdings/transactions/position_episodes/portfolios via the service-role
// client, replicating execute_trade's exact bookkeeping (weighted avg_cost,
// cash debits/credits, episode open/close boundaries) - confirmed against
// supabase/migrations/0008 and 0009's execute_trade bodies line by line.
// Because closed_at is set correctly at INSERT time here (never patched via
// UPDATE), the write-once trigger - which is declared `before update` only,
// per migration 0011's own comment - never engages at all. execute_trade,
// record_exit_reflection, and the trigger definitions are never touched.
//
// Pricing stays honest: computeExecutionPricing (lib/executionPricing.ts) is
// imported UNMODIFIED and is the only place spread/slippage/fill price are
// computed, exactly as it is for real trades. Entry/exit prices are real
// historical closes fetched from Twelve Data via the same helpers the app
// itself uses for backfill (ensureDailyPricesDeepCoverage,
// fetchDailyPricesFromTwelveData) - never invented numbers.
//
// Usage:
//   npx tsx scripts/seed-demo-account.ts --email <email>            (dry run - prints the plan, writes nothing)
//   npx tsx scripts/seed-demo-account.ts --email <email> --apply    (resets the account, then seeds it)
//   npx tsx scripts/seed-demo-account.ts --email <email> --teardown --apply   (wipes the account back to a fresh $100k account)
//
// Idempotent by construction: seeding always resets the target portfolio
// first (holdings/transactions/position_episodes deleted, cash and
// benchmark_start_date restored to defaults), so running it twice produces
// the same end state, never doubled data. Teardown performs that same reset
// and stops - since this is a dedicated demo account whose only rows are
// ones this script put there, "remove only what the seeder inserted" and
// "wipe the account clean" are the same operation.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { computeExecutionPricing, type SymbolLiquidityData, type OrderSide } from "../lib/executionPricing";
import { fetchDailyPricesFromTwelveData, computeAvgDollarVolume } from "../lib/marketDataProviders";
import { ensureDailyPricesDeepCoverage, type DailyPricePoint } from "../lib/marketDataCache";
import { STARTING_CASH } from "../lib/constants";

process.loadEnvFile(".env.local");

type AdminClient = SupabaseClient<Database>;

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
function parseArgs(argv: string[]) {
  let email: string | null = null;
  let apply = false;
  let teardown = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") email = argv[++i] ?? null;
    else if (arg.startsWith("--email=")) email = arg.slice("--email=".length);
    else if (arg === "--apply") apply = true;
    else if (arg === "--teardown") teardown = true;
  }
  return { email, apply, teardown };
}

function createAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient<Database>(url, key);
}

// ----------------------------------------------------------------------------
// Reset: mirrors reset_portfolio()'s own body exactly (same delete order:
// transactions before position_episodes, per the FK, matching migration
// 0011's own comment) - done via the admin client because reset_portfolio is
// security definer keyed off auth.uid(), which is null under a service-role
// JWT, so it can't be called as this script; the direct SQL below has the
// identical effect for this one portfolio.
// ----------------------------------------------------------------------------
async function resetPortfolio(admin: AdminClient, portfolioId: string): Promise<void> {
  const del1 = await admin.from("transactions").delete().eq("portfolio_id", portfolioId);
  if (del1.error) throw del1.error;
  const del2 = await admin.from("position_episodes").delete().eq("portfolio_id", portfolioId);
  if (del2.error) throw del2.error;
  const del3 = await admin.from("holdings").delete().eq("portfolio_id", portfolioId);
  if (del3.error) throw del3.error;
  const upd = await admin
    .from("portfolios")
    .update({ cash: STARTING_CASH, benchmark_start_date: new Date().toISOString() })
    .eq("id", portfolioId);
  if (upd.error) throw upd.error;
}

// ----------------------------------------------------------------------------
// Deep backfill of benchmark_prices (SPY) further back than the incremental
// ensureBenchmarkPricesUpToDate helper can reach - that helper only extends
// forward from whatever's already stored, so if the table's earliest row is
// more recent than our seed window, it can never fill the gap behind it.
// Same Twelve Data time_series call shape as lib/benchmarkPrices.ts, called
// directly here rather than through that file, since this is a one-off deep
// backfill, not the "keep it caught up to today" job that file exists for.
// ----------------------------------------------------------------------------
async function deepBackfillBenchmarkPrices(admin: AdminClient, apiKey: string, outputsize: number): Promise<void> {
  const response = await fetch(
    `https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`
  );
  if (!response.ok) throw new Error(`Twelve Data (SPY) request failed with status ${response.status}`);
  const data = await response.json();
  if (data.status === "error" || !Array.isArray(data.values)) {
    throw new Error(data.message ?? "Twelve Data returned no SPY data");
  }
  const rows = (data.values as { datetime: string; close: string }[])
    .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
    .filter((r) => Number.isFinite(r.close) && r.close > 0);
  if (rows.length === 0) return;
  const { error } = await admin.from("benchmark_prices").upsert(rows, { onConflict: "date" });
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Episode plan - see the script header for why every price below is a real
// historical close resolved at runtime, never a literal number.
// ----------------------------------------------------------------------------
interface EpisodePlan {
  symbol: string;
  fraction: number; // position of the OPEN date within the closed-episode zone, 0..1
  holdDays: number; // trading days between open and close; ignored for open positions
  outcome: "win" | "loss" | "open";
  sizeDollars: number; // opening buy's target dollar size
  addOn?: { afterDays: number; sizeDollars: number }; // add-on buy partway through the hold
  trim?: { afterDays: number; fraction: number }; // partial sell partway through (fraction of current shares)
  invalidationHit: boolean | null; // null = winners/opens, where the stop is never touched by design
  reflection: string | null;
  reflectionNote: string | null;
  critique: string | null;
  thesisWhyThis: string;
  thesisWhyNow: string;
  thesisInvalidation: string;
}

const RESERVED_TAIL_DAYS = 14; // trading days reserved at the end of the window for the 3 still-open positions

const CLOSED_EPISODES: EpisodePlan[] = [
  {
    symbol: "TSLA",
    fraction: 0.03,
    holdDays: 18,
    outcome: "loss",
    sizeDollars: 7500,
    invalidationHit: false,
    reflection: "exited_early_emotional",
    reflectionNote: "Sold into a red morning because the drawdown felt worse than the thesis said it should. Price never actually reached my stop.",
    critique: "You had a numeric invalidation and the stock never touched it. This wasn't your thesis failing - it was you flinching at volatility your own plan already accounted for. Next time, let the price hit your number before you act on how it feels.",
    thesisWhyThis: "Delivery growth has been reaccelerating and the story is shifting from 'car company' to energy storage plus autonomy optionality that the market isn't pricing in yet.",
    thesisWhyNow: "Just came off a guidance beat and the stock hasn't caught up to the print yet - the gap between the news and the price felt like the entry.",
    thesisInvalidation: "If it closes back below the pre-earnings breakout level, the move was a fakeout and I'm wrong about the reaction.",
  },
  {
    symbol: "AAPL",
    fraction: 0.11,
    holdDays: 5,
    outcome: "win",
    sizeDollars: 8200,
    invalidationHit: null,
    reflection: "thesis_played_out",
    reflectionNote: "Quick services-quarter pop, took it and moved on rather than getting greedy.",
    critique: "Clean in and out on a specific catalyst, sized reasonably, no second-guessing. This is what a disciplined short-term trade looks like - more of this.",
    thesisWhyThis: "Services margin has quietly become the story here and the market keeps valuing this like a hardware company.",
    thesisWhyNow: "Heading into the services-heavy quarter print, expecting another margin beat that re-rates the multiple.",
    thesisInvalidation: "If services growth decelerates instead of accelerating, the whole re-rating thesis is dead.",
  },
  {
    symbol: "AMD",
    fraction: 0.19,
    holdDays: 22,
    outcome: "loss",
    sizeDollars: 5000,
    addOn: { afterDays: 8, sizeDollars: 4000 },
    invalidationHit: true,
    reflection: "invalidated_as_expected",
    reflectionNote: "Added on the first dip thinking it was noise. It wasn't - data center guidance came in soft and the stock kept sliding until my stop finally hit.",
    critique: "The add-on is the part worth examining. You averaged down into a name that was already breaking your own thesis, and the eventual exit happened at your invalidation level - which means the plan worked, but the extra capital you put in on the way down made the loss bigger than it needed to be.",
    thesisWhyThis: "Data center GPU share gains against the incumbent look durable, and the multiple is still cheaper than the growth rate implies.",
    thesisWhyNow: "New accelerator ramp is starting to show up in the numbers and I want to be in before the next earnings print confirms it.",
    thesisInvalidation: "If data center revenue guidance gets cut, the share-gain story is broken and I'm out, no averaging down.",
  },
  {
    symbol: "MSFT",
    fraction: 0.27,
    holdDays: 4,
    outcome: "win",
    sizeDollars: 5400,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: null,
    thesisWhyThis: "Azure growth reacceleration plus the AI-copilot attach rate finally showing up as real revenue, not just a slide in an earnings deck.",
    thesisWhyNow: "Cloud spend commentary from peers this week has been strong - wanted exposure ahead of the read-through.",
    thesisInvalidation: "If Azure growth decelerates instead, the reacceleration story doesn't hold and I'd expect the stock to give this back fast.",
  },
  {
    symbol: "NFLX",
    fraction: 0.35,
    holdDays: 15,
    outcome: "loss",
    sizeDollars: 6800,
    invalidationHit: false,
    reflection: "exited_early_new_info",
    reflectionNote: "A competitor announced a bigger content push than expected and I decided not to wait around to see if it actually mattered.",
    critique: "This is a defensible reason to exit early even without hitting your stop - new information genuinely changed the risk, it wasn't just nerves. Worth noting for next time: consider writing down what would make you exit early ON NEWS, not just on price, so it's part of the plan instead of an improvisation.",
    thesisWhyThis: "Ad-tier subscriber growth is still underappreciated and password-sharing crackdown revenue hasn't fully rolled through the model yet.",
    thesisWhyNow: "Subscriber numbers beat last quarter and the stock barely moved - felt like a mispriced reaction.",
    thesisInvalidation: "If ad-tier growth stalls or a major competitor undercuts pricing meaningfully, the subscriber-growth thesis weakens.",
  },
  {
    symbol: "NVDA",
    fraction: 0.43,
    holdDays: 7,
    outcome: "win",
    sizeDollars: 6000,
    addOn: { afterDays: 3, sizeDollars: 3000 },
    invalidationHit: null,
    reflection: "thesis_played_out",
    reflectionNote: "Added into strength once the move confirmed rather than chasing on day one - worked out better than sizing in all at once would have.",
    critique: "Adding to a winner that's confirming your thesis, instead of a loser that's denying it (see the AMD episode), is exactly the right instinct. This is the version of 'over-trading' that actually improves outcomes.",
    thesisWhyThis: "Compute demand for training runs shows no sign of slowing and the backlog commentary keeps getting longer, not shorter.",
    thesisWhyNow: "A major cloud provider just announced a large capacity expansion that flows straight through to orders here.",
    thesisInvalidation: "If a hyperscaler announces it's cutting capex or pivoting to a competitor's chips, this thesis is over.",
  },
  {
    symbol: "COST",
    fraction: 0.51,
    holdDays: 24,
    outcome: "loss",
    sizeDollars: 11000,
    invalidationHit: true,
    reflection: "invalidated_as_expected",
    reflectionNote: "Comparable sales growth actually decelerated two months running, which is exactly what I said would prove me wrong. Sold when it happened, no drama.",
    critique: "This is the whole point of writing an invalidation down before you're in the trade. The thesis broke, the plan said sell, you sold. It still lost money - that's fine. A good loss is one that happened for the stated reason, on schedule.",
    thesisWhyThis: "Membership renewal rates are the highest-quality recurring revenue in retail and the market undervalues how sticky that is.",
    thesisWhyNow: "Membership fee increase just went into effect and I wanted exposure to the earnings lift before it showed up in guidance.",
    thesisInvalidation: "If comparable sales growth decelerates for two consecutive months, the membership-quality thesis isn't showing up in the numbers and I'm wrong.",
  },
  {
    symbol: "AMZN",
    fraction: 0.59,
    holdDays: 3,
    outcome: "win",
    sizeDollars: 4200,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: null,
    thesisWhyThis: "AWS operating margin has been expanding faster than the market models it, and retail margin is improving alongside it - both engines firing at once.",
    thesisWhyNow: "AWS re:Invent announcements this week point at accelerating enterprise adoption, ahead of the read-through in the next print.",
    thesisInvalidation: "If AWS growth decelerates below the prior quarter's pace, the margin-expansion thesis is running out of room.",
  },
  {
    symbol: "JPM",
    fraction: 0.67,
    holdDays: 12,
    outcome: "loss",
    sizeDollars: 9000,
    trim: { afterDays: 5, fraction: 0.4 },
    invalidationHit: false,
    reflection: "exited_early_emotional",
    reflectionNote: "Trimmed a third of the position on a down day that turned out to be noise, then sold the rest a week later still without the stop ever being hit. Should have just held or cut it all at once.",
    critique: "The partial trim didn't actually reduce your risk in a meaningful way here - it just turned one decision into two, both made from the same place (discomfort with a red day), and cost you extra spread and slippage in the process. If the plan doesn't call for scaling out, scaling out isn't free.",
    thesisWhyThis: "Net interest income has more room to run than the market is pricing in, and the buyback pace is unusually aggressive for a bank this size.",
    thesisWhyNow: "Rate-cut expectations just got pushed further out, which extends the net-interest-income tailwind longer than consensus assumed.",
    thesisInvalidation: "If rate-cut expectations pull back forward again, the net-interest-income tailwind shortens and the thesis loses its edge.",
  },
  {
    symbol: "GOOGL",
    fraction: 0.75,
    holdDays: 6,
    outcome: "win",
    sizeDollars: 9800,
    invalidationHit: null,
    reflection: "thesis_played_out",
    reflectionNote: "Search revenue held up fine despite the AI-disruption narrative, exactly as expected. Took the win at a clean resistance level.",
    critique: null,
    thesisWhyThis: "The market has been pricing in search share loss to AI chatbots faster than the actual usage data supports.",
    thesisWhyNow: "Quarterly search revenue print is coming up and I think the disruption fear is overdone relative to what the numbers will show.",
    thesisInvalidation: "If search revenue growth actually decelerates meaningfully, the disruption narrative is real and I'm on the wrong side of it.",
  },
  {
    symbol: "DIS",
    fraction: 0.82,
    holdDays: 16,
    outcome: "loss",
    sizeDollars: 6200,
    invalidationHit: true,
    reflection: "invalidated_as_expected",
    reflectionNote: "Streaming subscriber additions came in below the number I'd written down as my line in the sand. Sold within the same week.",
    critique: null,
    thesisWhyThis: "Streaming profitability is finally inflecting and park attendance has stayed resilient despite the macro headlines.",
    thesisWhyNow: "First profitable streaming quarter is about to be reported and I wanted in ahead of that becoming consensus.",
    thesisInvalidation: "If streaming subscriber additions come in below the prior quarter's pace, the inflection story isn't confirmed yet.",
  },
  {
    symbol: "META",
    fraction: 0.90,
    holdDays: 5,
    outcome: "win",
    sizeDollars: 12500,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: "Full size on a single earnings-adjacent catalyst without an add-on or a trim - this is the cleanest, simplest episode in the whole book. Worth noticing what 'boring and correct' looks like next to the more complicated trades above.",
    thesisWhyThis: "Ad pricing has been recovering faster than headcount cuts would suggest management expects, which is a leading signal for margin.",
    thesisWhyNow: "Ad pricing commentary from smaller platforms this week has been strong, and that usually leads this name's own print by a quarter.",
    thesisInvalidation: "If ad pricing commentary turns negative industry-wide, the margin-recovery read-through doesn't hold.",
  },
  {
    symbol: "CRM",
    fraction: 0.95,
    holdDays: 4,
    outcome: "win",
    sizeDollars: 14000,
    trim: { afterDays: 2, fraction: 0.35 },
    invalidationHit: null,
    reflection: "thesis_played_out",
    reflectionNote: "Trimmed a third into initial strength to lock in something, then let the rest run into the print. Worked out, though I'm not sure the trim was necessary.",
    critique: "The trim protected some gains but also means you'll never know if holding the full size would have been better - that's the tradeoff of scaling out of winners. Not wrong, just worth being deliberate about rather than doing it out of habit.",
    thesisWhyThis: "Enterprise AI-agent add-on pricing is a genuinely new revenue line that the market hasn't fully modeled into the multiple yet.",
    thesisWhyNow: "Early customer adoption numbers for the new AI product leaked ahead of the official print, and they looked strong.",
    thesisInvalidation: "If the official numbers come in well below what leaked, the market will treat this as a broken promise and punish the stock hard.",
  },
];

const OPEN_EPISODES: EpisodePlan[] = [
  {
    symbol: "ORCL",
    fraction: 0, // unused for open episodes; placed via OPEN_TRADING_DAYS_AGO below
    holdDays: 0,
    outcome: "open",
    sizeDollars: 7000,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: null,
    thesisWhyThis: "Cloud infrastructure backlog keeps growing faster than the market credits a 'legacy database' company for.",
    thesisWhyNow: "New multi-year cloud contracts were just disclosed and haven't been fully reflected in estimates yet.",
    thesisInvalidation: "If backlog growth decelerates next quarter, the re-rating case weakens considerably.",
  },
  {
    symbol: "AAPL",
    fraction: 0,
    holdDays: 0,
    outcome: "open",
    sizeDollars: 5500,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: null,
    thesisWhyThis: "Wearables and services keep growing as a share of the mix, which the market still prices as a phone company.",
    thesisWhyNow: "New product-cycle rumors are building ahead of the fall announcement window.",
    thesisInvalidation: "If wearables revenue growth actually slows this quarter, the mix-shift thesis stalls.",
  },
  {
    symbol: "MSFT",
    fraction: 0,
    holdDays: 0,
    outcome: "open",
    sizeDollars: 9000,
    invalidationHit: null,
    reflection: null,
    reflectionNote: null,
    critique: null,
    thesisWhyThis: "Copilot seat growth across enterprise customers looks like the next leg of the Azure story, still early innings.",
    thesisWhyNow: "First full quarter of Copilot pricing data is about to be reported.",
    thesisInvalidation: "If enterprise seat growth for Copilot disappoints, the next-leg narrative doesn't have legs yet.",
  },
];

// Trading days back from the most recent available trading day, for each
// still-open position - kept small and distinct so all three land inside
// the reserved tail zone.
const OPEN_TRADING_DAYS_AGO = [12, 7, 3];

// ----------------------------------------------------------------------------
// Trade leg model - every buy/sell that will become one transactions row.
// ----------------------------------------------------------------------------
interface TradeLeg {
  episodeKey: string; // symbol + "#" + planIndex, unique per episode
  symbol: string;
  side: OrderSide;
  date: string; // trading date, YYYY-MM-DD
  shares: number;
  quotedPrice: number;
  isOpeningBuy: boolean;
  isClosingSell: boolean;
  note: string;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Safe mid-day UTC time that maps to the same US-Eastern calendar date
// regardless of EDT/EST offset (13:30-21:00 UTC is always market hours in
// New York) - avoids benchmark_trading_date rolling the timestamp onto the
// adjacent calendar day.
function midDayTimestamp(dateStr: string, hourOffset: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCHours(16 + (hourOffset % 3), 15 + ((hourOffset * 7) % 30), 0, 0);
  return d.toISOString();
}

async function main() {
  const { email, apply, teardown } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-demo-account.ts --email <email> [--apply] [--teardown]");
    process.exit(1);
  }

  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .eq("email", email)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (!profile) {
    console.error(`No profile found for ${email}. This account must have signed in at least once before it can be seeded.`);
    process.exit(1);
  }

  const { data: portfolio, error: portfolioErr } = await admin
    .from("portfolios")
    .select("id, cash")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (portfolioErr) throw portfolioErr;
  if (!portfolio) {
    console.error(`No portfolio found for ${email}.`);
    process.exit(1);
  }

  console.log(`Target: ${email} (${profile.display_name ?? "no display name"}), portfolio ${portfolio.id}, current cash $${portfolio.cash}`);

  if (teardown) {
    if (!apply) {
      console.log("[dry run] Would delete all transactions/position_episodes/holdings for this portfolio and reset cash to $100,000. Re-run with --apply to execute.");
      return;
    }
    await resetPortfolio(admin, portfolio.id);
    console.log("Teardown complete: portfolio reset to a fresh $100,000 account.");
    return;
  }

  const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
  if (!twelveDataKey) throw new Error("Missing TWELVE_DATA_API_KEY in .env.local");

  // ---- Deep backfill benchmark_prices (SPY) covering the full seed window ----
  console.log("Backfilling benchmark_prices (SPY) history...");
  await deepBackfillBenchmarkPrices(admin, twelveDataKey, 140);

  const { data: benchRows, error: benchErr } = await admin
    .from("benchmark_prices")
    .select("date")
    .order("date", { ascending: true });
  if (benchErr) throw benchErr;
  const tradingDays = (benchRows ?? []).map((r) => r.date);
  if (tradingDays.length < 90) {
    throw new Error(`Only ${tradingDays.length} trading days available after backfill - need at least 90 to safely schedule the plan.`);
  }
  // Episodes are scheduled only within the most recent ~3.4 months of the
  // fetched calendar - the wider backfill above just gives ensureDailyPricesDeepCoverage
  // and the exit-vs-plan lookback comfortable margin behind that.
  const SCHEDULING_WINDOW_DAYS = 72;
  const windowDays = tradingDays.slice(-SCHEDULING_WINDOW_DAYS);
  console.log(`Trading-day calendar: ${tradingDays[0]} to ${tradingDays[tradingDays.length - 1]} (${tradingDays.length} real NYSE days).`);
  console.log(`Scheduling window: ${windowDays[0]} to ${windowDays[windowDays.length - 1]} (${windowDays.length} days, ~3.4 months).`);

  // ---- Deep backfill symbol_daily_prices for every symbol used -----------
  const allSymbols = Array.from(new Set([...CLOSED_EPISODES, ...OPEN_EPISODES].map((e) => e.symbol)));
  const dailyPricesBySymbol = new Map<string, Map<string, number>>();
  const avgDollarVolumeBySymbol = new Map<string, number | null>();

  for (const symbol of allSymbols) {
    console.log(`Backfilling symbol_daily_prices for ${symbol}...`);
    await ensureDailyPricesDeepCoverage(symbol, tradingDays[0], () =>
      fetchDailyPricesFromTwelveData(symbol, twelveDataKey, 140)
    );
    const { data: rows, error } = await admin
      .from("symbol_daily_prices")
      .select("date, close, volume")
      .eq("symbol", symbol)
      .order("date", { ascending: true });
    if (error) throw error;
    const points: DailyPricePoint[] = (rows ?? []).map((r) => ({
      date: r.date,
      close: Number(r.close),
      volume: r.volume === null ? null : Number(r.volume),
    }));
    const closeByDate = new Map<string, number>();
    for (const p of points) closeByDate.set(p.date, p.close);
    dailyPricesBySymbol.set(symbol, closeByDate);
    avgDollarVolumeBySymbol.set(symbol, computeAvgDollarVolume(points));
  }

  // Best-effort real market cap, from whatever's already cached - honest
  // reuse of real data rather than a guess, but never a blocking fetch.
  const marketCapBySymbol = new Map<string, number | null>();
  for (const symbol of allSymbols) {
    const { data } = await admin.from("symbol_profiles").select("market_cap").eq("symbol", symbol).maybeSingle();
    marketCapBySymbol.set(symbol, data?.market_cap === undefined || data?.market_cap === null ? null : Number(data.market_cap));
  }

  function closeOn(symbol: string, date: string): number {
    const map = dailyPricesBySymbol.get(symbol);
    const close = map?.get(date);
    if (close === undefined) {
      throw new Error(`No real close price for ${symbol} on ${date} - trading-day calendar and symbol history are out of sync.`);
    }
    return close;
  }

  // Nearest available trading date at-or-before the requested index,
  // tolerant of a symbol occasionally missing a bar Twelve Data has for SPY.
  function resolveTradableDate(symbol: string, index: number): string {
    const map = dailyPricesBySymbol.get(symbol)!;
    for (let i = index; i >= 0; i--) {
      if (map.has(windowDays[i])) return windowDays[i];
    }
    throw new Error(`No tradable date found for ${symbol} at or before index ${index}.`);
  }

  function liquidityFor(symbol: string): SymbolLiquidityData {
    return { marketCap: marketCapBySymbol.get(symbol) ?? null, avgDollarVolume20d: avgDollarVolumeBySymbol.get(symbol) ?? null };
  }

  // ---- Resolve dates + build trade legs + invalidation prices -------------
  const closedZoneLen = windowDays.length - RESERVED_TAIL_DAYS;

  interface ResolvedEpisode {
    plan: EpisodePlan;
    key: string;
    openDate: string;
    closeDate: string | null;
    invalidationPrice: number | null;
    legs: TradeLeg[];
  }

  const resolved: ResolvedEpisode[] = [];

  // Minimum raw close-to-close move required, in the intended direction,
  // before a window is accepted for a win/loss episode - comfortably above
  // the round-trip spread+slippage these liquid large-caps actually carry
  // at the position sizes used here (well under 1%), so the sign survives
  // computeExecutionPricing's adverse-cost adjustment on both legs.
  const MIN_MOVE_MARGIN_PCT = 1.6;

  // A fixed target date rarely lands on a real window that actually moved
  // the intended direction - real prices don't cooperate with a hand-picked
  // slot. This searches nearby open dates and nearby hold lengths for a
  // REAL window that satisfies the intended win/loss outcome with margin,
  // preferring the candidate closest to the originally planned slot and
  // hold length. Verified against computeEpisodePnl's own formula below
  // (the post-execution-cost check) before anything is written.
  function findRealWindow(plan: EpisodePlan, baseOpenIndex: number): { openDate: string; closeDate: string; holdDays: number } {
    const holdDeltas = [0, -2, 2, -4, 4, -6, 6, -8, 8];
    const offsetRange = 20;
    let best: { openDate: string; closeDate: string; holdDays: number; score: number } | null = null;

    for (const holdDelta of holdDeltas) {
      const holdDays = Math.max(2, plan.holdDays + holdDelta);
      for (let offset = 0; offset <= offsetRange; offset++) {
        for (const sign of offset === 0 ? [1] : [1, -1]) {
          const openIndex = baseOpenIndex + sign * offset;
          if (openIndex < 1) continue;
          let openDate: string;
          try {
            openDate = resolveTradableDate(plan.symbol, openIndex);
          } catch {
            continue;
          }
          const openIdx = windowDays.indexOf(openDate);
          const closeIdx = openIdx + holdDays;
          if (closeIdx >= windowDays.length - 1) continue; // leave the reserved tail alone
          let closeDate: string;
          try {
            closeDate = resolveTradableDate(plan.symbol, closeIdx);
          } catch {
            continue;
          }
          if (closeDate === openDate) continue;
          const openPrice = closeOn(plan.symbol, openDate);
          const closePrice = closeOn(plan.symbol, closeDate);
          const movePct = ((closePrice - openPrice) / openPrice) * 100;
          const meetsMargin = plan.outcome === "win" ? movePct >= MIN_MOVE_MARGIN_PCT : movePct <= -MIN_MOVE_MARGIN_PCT;
          if (!meetsMargin) continue;
          const score = -(offset + Math.abs(holdDelta) * 1.5);
          if (!best || score > best.score) best = { openDate, closeDate, holdDays, score };
        }
      }
    }

    if (!best) {
      throw new Error(`Could not find a real ${plan.outcome} window for ${plan.symbol} near the planned slot within +/-${offsetRange} trading days and hold-length variants ${holdDeltas.join(",")}. Pick a different symbol or slot for this episode.`);
    }
    return best;
  }

  for (const [i, plan] of CLOSED_EPISODES.entries()) {
    const key = `${plan.symbol}#${i}`;
    const baseOpenIndex = Math.max(1, Math.round(plan.fraction * closedZoneLen));
    const { openDate, closeDate, holdDays: resolvedHoldDays } = findRealWindow(plan, baseOpenIndex);
    const openIdxInCalendar = windowDays.indexOf(openDate);
    const closeIndex = windowDays.indexOf(closeDate);
    plan.holdDays = resolvedHoldDays; // keep add-on/trim "afterDays" scaling consistent with the actual resolved hold length

    const openPrice = closeOn(plan.symbol, openDate);
    const closePrice = closeOn(plan.symbol, closeDate);

    // Real price path across the holding window, for a plausible
    // invalidation price and for the exit-vs-plan panic/disciplined split.
    const windowDates = windowDays.slice(openIdxInCalendar, closeIndex + 1).filter((d) => dailyPricesBySymbol.get(plan.symbol)!.has(d));
    const windowCloses = windowDates.map((d) => closeOn(plan.symbol, d));
    const windowMin = Math.min(...windowCloses);

    let invalidationPrice: number;
    if (plan.outcome === "win") {
      // Never hit: comfortably below the realized minimum for the window.
      invalidationPrice = round(windowMin * 0.9, 2);
    } else if (plan.invalidationHit) {
      // Disciplined: just above the realized minimum, so the real price path crossed it.
      invalidationPrice = round(windowMin * 1.005, 2);
    } else {
      // Panic: below the realized minimum, so it was never actually touched.
      invalidationPrice = round(windowMin * 0.97, 2);
    }

    const shares = round(plan.sizeDollars / openPrice, 4);
    const legs: TradeLeg[] = [
      {
        episodeKey: key,
        symbol: plan.symbol,
        side: "BUY",
        date: openDate,
        shares,
        quotedPrice: openPrice,
        isOpeningBuy: true,
        isClosingSell: false,
        note: `Opening buy - ${plan.symbol}`,
      },
    ];

    let sharesHeld = shares;

    if (plan.addOn) {
      const addOnIndex = Math.min(openIdxInCalendar + plan.addOn.afterDays, closeIndex - 1);
      const addOnDate = resolveTradableDate(plan.symbol, addOnIndex);
      const addOnPrice = closeOn(plan.symbol, addOnDate);
      const addOnShares = round(plan.addOn.sizeDollars / addOnPrice, 4);
      legs.push({
        episodeKey: key,
        symbol: plan.symbol,
        side: "BUY",
        date: addOnDate,
        shares: addOnShares,
        quotedPrice: addOnPrice,
        isOpeningBuy: false,
        isClosingSell: false,
        note: `Add-on buy - ${plan.symbol}`,
      });
      sharesHeld += addOnShares;
    }

    if (plan.trim) {
      const trimIndex = Math.min(openIdxInCalendar + plan.trim.afterDays, closeIndex - 1);
      const trimDate = resolveTradableDate(plan.symbol, trimIndex);
      const trimPrice = closeOn(plan.symbol, trimDate);
      const trimShares = round(sharesHeld * plan.trim.fraction, 4);
      legs.push({
        episodeKey: key,
        symbol: plan.symbol,
        side: "SELL",
        date: trimDate,
        shares: trimShares,
        quotedPrice: trimPrice,
        isOpeningBuy: false,
        isClosingSell: false,
        note: `Partial trim - ${plan.symbol}`,
      });
      sharesHeld -= trimShares;
    }

    legs.push({
      episodeKey: key,
      symbol: plan.symbol,
      side: "SELL",
      date: closeDate,
      shares: round(sharesHeld, 4),
      quotedPrice: closePrice,
      isOpeningBuy: false,
      isClosingSell: true,
      note: `Closing sell - ${plan.symbol}`,
    });

    resolved.push({ plan, key, openDate, closeDate, invalidationPrice, legs });
  }

  for (const [i, plan] of OPEN_EPISODES.entries()) {
    const key = `${plan.symbol}#open${i}`;
    const daysAgo = OPEN_TRADING_DAYS_AGO[i];
    const openIndex = windowDays.length - 1 - daysAgo;
    const openDate = resolveTradableDate(plan.symbol, openIndex);
    const openPrice = closeOn(plan.symbol, openDate);
    const shares = round(plan.sizeDollars / openPrice, 4);

    // Invalidation set below the realized minimum since open, so it reads
    // as a real, un-triggered stop for a position still in progress.
    const sinceOpenCloses = windowDays
      .slice(windowDays.indexOf(openDate))
      .filter((d) => dailyPricesBySymbol.get(plan.symbol)!.has(d))
      .map((d) => closeOn(plan.symbol, d));
    const invalidationPrice = round(Math.min(...sinceOpenCloses) * 0.9, 2);

    resolved.push({
      plan,
      key,
      openDate,
      closeDate: null,
      invalidationPrice,
      legs: [
        {
          episodeKey: key,
          symbol: plan.symbol,
          side: "BUY",
          date: openDate,
          shares,
          quotedPrice: openPrice,
          isOpeningBuy: true,
          isClosingSell: false,
          note: `Opening buy - ${plan.symbol}`,
        },
      ],
    });
  }

  // ---- Chronological replay: cash, holdings, execution pricing -----------
  const allLegs = resolved
    .flatMap((r) => r.legs)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.isOpeningBuy === b.isOpeningBuy ? 0 : a.isOpeningBuy ? -1 : 1));

  let runningCash = STARTING_CASH;
  const runningHoldings = new Map<string, { shares: number; avgCost: number }>();

  interface PricedLeg extends TradeLeg {
    fillPrice: number;
    spreadCost: number;
    slippageCost: number;
    total: number;
    timeOffsetIndex: number;
  }

  const pricedLegs: PricedLeg[] = [];
  let timeCounter = 0;

  for (const leg of allLegs) {
    const pricing = computeExecutionPricing({
      quotedPrice: leg.quotedPrice,
      side: leg.side,
      shares: leg.shares,
      liquidity: liquidityFor(leg.symbol),
    });
    const total = round(leg.shares * pricing.fillPrice, 2);

    if (leg.side === "BUY") {
      if (total > runningCash) {
        throw new Error(`Cash shortfall: ${leg.symbol} buy on ${leg.date} costs $${total}, only $${round(runningCash, 2)} available.`);
      }
      runningCash = round(runningCash - total, 2);
      const existing = runningHoldings.get(leg.symbol);
      const newShares = round((existing?.shares ?? 0) + leg.shares, 4);
      const newAvgCost = existing
        ? (existing.avgCost * existing.shares + total) / newShares
        : pricing.fillPrice;
      runningHoldings.set(leg.symbol, { shares: newShares, avgCost: newAvgCost });
    } else {
      const existing = runningHoldings.get(leg.symbol);
      if (!existing || existing.shares + 1e-6 < leg.shares) {
        throw new Error(`Share shortfall: ${leg.symbol} sell on ${leg.date} needs ${leg.shares}, only ${existing?.shares ?? 0} held.`);
      }
      runningCash = round(runningCash + total, 2);
      const newShares = round(existing.shares - leg.shares, 4);
      if (newShares <= 0.0001) runningHoldings.delete(leg.symbol);
      else runningHoldings.set(leg.symbol, { shares: newShares, avgCost: existing.avgCost });
    }

    pricedLegs.push({ ...leg, fillPrice: round(pricing.fillPrice, 6), spreadCost: round(pricing.spreadCost, 6), slippageCost: round(pricing.slippageCost, 6), total, timeOffsetIndex: timeCounter++ });
  }

  const finalCash = runningCash;
  const finalHoldings = Array.from(runningHoldings.entries());

  // ---- Report the plan --------------------------------------------------
  const winCount = CLOSED_EPISODES.filter((e) => e.outcome === "win").length;
  const lossCount = CLOSED_EPISODES.filter((e) => e.outcome === "loss").length;
  console.log("");
  console.log(`Plan: ${CLOSED_EPISODES.length} closed episodes (${winCount} win / ${lossCount} loss), ${OPEN_EPISODES.length} open.`);
  console.log(`Total legs: ${pricedLegs.length}. Starting cash $${STARTING_CASH} -> final cash $${finalCash.toFixed(2)}.`);
  console.log(`Final open holdings: ${finalHoldings.map(([s, h]) => `${s} ${h.shares}sh @ $${h.avgCost.toFixed(2)}`).join(", ")}`);

  // Verify the REAL post-execution-cost P&L matches each episode's intended
  // win/loss label - a thin raw price move could flip sign once spread and
  // slippage (both adverse, on both legs) are applied. This is exactly the
  // number computeEpisodePnl (lib/decisionScorecard.ts) will compute from
  // the transactions this script is about to write, so checking it here
  // with the same formula catches a mislabeled episode before it ships.
  let labelMismatch = false;
  for (const r of resolved) {
    const legs = pricedLegs.filter((l) => l.episodeKey === r.key);
    const buysCost = legs.filter((l) => l.side === "BUY").reduce((s, l) => s + l.total, 0);
    const sellProceeds = legs.filter((l) => l.side === "SELL").reduce((s, l) => s + l.total, 0);
    const pnl = round(sellProceeds - buysCost, 2);
    const pnlPct = buysCost > 0 ? round((pnl / buysCost) * 100, 2) : 0;
    const actualOutcome = r.plan.outcome === "open" ? "open" : pnl > 0 ? "win" : "loss";
    const mismatch = r.plan.outcome !== "open" && actualOutcome !== r.plan.outcome;
    if (mismatch) labelMismatch = true;
    console.log(
      `  ${r.plan.symbol.padEnd(6)} ${r.plan.outcome.padEnd(4)} open ${r.openDate}${r.closeDate ? ` -> close ${r.closeDate}` : " (open)"}  invalidation $${r.invalidationPrice}  pnl $${pnl} (${pnlPct}%)${mismatch ? "  <-- MISMATCH: real P&L contradicts intended outcome" : ""}`
    );
  }

  if (labelMismatch) {
    throw new Error("At least one episode's real post-execution-cost P&L contradicts its intended win/loss label - fix sizeDollars/dates/holdDays for that symbol before applying.");
  }

  if (!apply) {
    console.log("\n[dry run] No changes written. Re-run with --apply to reset the account and insert this plan.");
    return;
  }

  // ---- Apply: reset, then insert episodes -> transactions -> holdings ----
  console.log("\nResetting portfolio to a clean $100,000 account...");
  await resetPortfolio(admin, portfolio.id);

  console.log("Inserting position_episodes...");
  const episodeIdByKey = new Map<string, string>();
  for (const r of resolved) {
    const closedAtIso = r.closeDate ? midDayTimestamp(r.closeDate, 2) : null;
    const critiqueGeneratedAt = r.plan.critique && r.closeDate ? midDayTimestamp(r.closeDate, 5) : null;
    const { data, error } = await admin
      .from("position_episodes")
      .insert({
        portfolio_id: portfolio.id,
        symbol: r.plan.symbol,
        opened_at: midDayTimestamp(r.openDate, 0),
        closed_at: closedAtIso,
        thesis_why_this: r.plan.thesisWhyThis,
        thesis_why_now: r.plan.thesisWhyNow,
        thesis_invalidation: r.plan.thesisInvalidation,
        thesis_invalidation_price: r.invalidationPrice,
        exit_reflection: r.plan.reflection,
        exit_reflection_note: r.plan.reflectionNote,
        critique: r.plan.critique,
        critique_generated_at: critiqueGeneratedAt,
      })
      .select("id")
      .single();
    if (error) throw error;
    episodeIdByKey.set(r.key, data.id);
  }

  console.log("Inserting transactions...");
  const transactionRows = pricedLegs.map((leg) => ({
    portfolio_id: portfolio.id,
    symbol: leg.symbol,
    type: leg.side === "BUY" ? "buy" : "sell",
    shares: leg.shares,
    price: leg.fillPrice,
    total: leg.total,
    quoted_price: leg.quotedPrice,
    spread_cost: leg.spreadCost,
    slippage_cost: leg.slippageCost,
    episode_id: episodeIdByKey.get(leg.episodeKey)!,
    note: leg.note,
    executed_at: midDayTimestamp(leg.date, leg.timeOffsetIndex),
  }));
  const { error: txError } = await admin.from("transactions").insert(transactionRows);
  if (txError) throw txError;

  console.log("Inserting final holdings for still-open positions...");
  if (finalHoldings.length > 0) {
    const holdingsRows = finalHoldings.map(([symbol, h]) => ({
      portfolio_id: portfolio.id,
      symbol,
      shares: h.shares,
      avg_cost: round(h.avgCost, 6),
    }));
    const { error: holdingsError } = await admin.from("holdings").insert(holdingsRows);
    if (holdingsError) throw holdingsError;
  }

  console.log("Updating portfolio cash...");
  const { error: cashError } = await admin.from("portfolios").update({ cash: finalCash }).eq("id", portfolio.id);
  if (cashError) throw cashError;

  console.log(`\nDone. ${email} now has ${resolved.length} episodes (${CLOSED_EPISODES.length} closed, ${OPEN_EPISODES.length} open), cash $${finalCash.toFixed(2)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
