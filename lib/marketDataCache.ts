import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const LEASE_SECONDS = 8;

// Fresh / stale / pending / unavailable - see supabase/migrations/
// 0010_market_data_cache.sql for the full reasoning. Pending is not an
// error: it means a claim is held and nothing has ever been written yet
// (the cold-cache case) - callers should retry shortly, not render a
// failure. Stale always carries real (if old) data plus its true asOf
// timestamp, never presented as current.
export type CacheState<Data> =
  | { status: "fresh"; data: Data; asOf: string }
  | { status: "stale"; data: Data; asOf: string }
  | { status: "pending" }
  | { status: "unavailable"; error: string };

type ClaimTable = "symbol_quotes" | "symbol_profiles" | "symbol_daily_prices_claims";

// Two statements, not one, because PostgREST's upsert has no way to attach
// a conditional WHERE to its ON CONFLICT DO UPDATE action - the single
// combined statement in the migration's own comments only works issued
// directly against Postgres, not through supabase-js. This achieves the
// same atomicity in two atomic steps instead of one atomic step:
//
// 1) A plain conditional UPDATE claims an existing-but-expired (or never
//    claimed) row - the common case once the cache is warm, one round
//    trip. Postgres serializes concurrent UPDATEs to the same row, so
//    exactly one concurrent caller can win this.
// 2) Only if that matched nothing (ambiguous: could mean "row doesn't
//    exist yet" - the exact cold-cache bug - or "someone else already
//    holds the lease") does a fallback INSERT ... ON CONFLICT DO NOTHING
//    resolve the ambiguity: if the row genuinely didn't exist, this
//    INSERT wins it outright (Postgres allows only one concurrent INSERT
//    to succeed against a unique key; the rest see the conflict). If the
//    row did exist (someone else's active lease), the INSERT is skipped
//    and this caller is correctly a follower.
async function claim(admin: AdminClient, table: ClaimTable, symbol: string): Promise<"leader" | "follower"> {
  const leaseUntil = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: updated } = await admin
    .from(table)
    .update({ fetching_until: leaseUntil })
    .eq("symbol", symbol)
    .or(`fetching_until.is.null,fetching_until.lt.${nowIso}`)
    .select("symbol");

  if (updated && updated.length > 0) return "leader";

  const { data: inserted } = await admin
    .from(table)
    .upsert({ symbol, fetching_until: leaseUntil }, { onConflict: "symbol", ignoreDuplicates: true })
    .select("symbol");

  return inserted && inserted.length > 0 ? "leader" : "follower";
}

// Explicit, not incidental: the write that lands real data always clears
// fetching_until in the same statement (see writeSingleRow below). This
// is only needed on the *failure* path, so a leader whose upstream fetch
// throws doesn't leave the lease held for the full 8s - the next request
// can retry immediately instead of waiting out a lease nobody is using.
async function releaseLease(admin: AdminClient, table: ClaimTable, symbol: string): Promise<void> {
  await admin.from(table).update({ fetching_until: null }).eq("symbol", symbol);
}

interface SingleRowCache<Row, Data> {
  table: "symbol_quotes" | "symbol_profiles";
  selectColumns: string;
  ttlMs: number;
  hasData: (row: Row) => boolean;
  rowToData: (row: Row) => Data;
  dataToWriteColumns: (data: Data) => Record<string, unknown>;
}

// Shared skeleton for the two caches that are naturally one row per
// symbol (quotes, profiles) - same read/claim/write/reread shape, just
// parameterized by table, TTL, and the row<->data mapping. Daily bars use
// their own function (getCachedDailyPrices below): multiple rows per
// symbol and gap-based freshness instead of a TTL don't fit this shape.
async function getSingleRowCached<Row extends { updated_at: string | null; fetching_until: string | null }, Data>(
  symbol: string,
  config: SingleRowCache<Row, Data>,
  fetchUpstream: () => Promise<Data>
): Promise<CacheState<Data>> {
  const admin = createAdminClient();

  async function read(): Promise<Row | null> {
    const { data } = await admin
      .from(config.table)
      .select(config.selectColumns)
      .eq("symbol", symbol)
      .maybeSingle();
    return data as Row | null;
  }

  async function write(data: Data): Promise<void> {
    await admin
      .from(config.table)
      .update({ ...config.dataToWriteColumns(data), updated_at: new Date().toISOString(), fetching_until: null })
      .eq("symbol", symbol);
  }

  async function populate(): Promise<CacheState<Data>> {
    // fetching_until = null is ambiguous: it means either "never
    // populated" or "another leader just finished refreshing and
    // released it." A caller can win claim() legitimately (the row-level
    // lock guarantees only one UPDATE/INSERT succeeds at a time) and
    // still be arriving after that release - the lease being available
    // doesn't mean the data is stale *right now*. Re-check before
    // spending an upstream call the true leader already paid for.
    const current = await read();
    if (current && config.hasData(current) && current.updated_at) {
      const age = Date.now() - new Date(current.updated_at).getTime();
      if (age < config.ttlMs) {
        await releaseLease(admin, config.table, symbol);
        return { status: "fresh", data: config.rowToData(current), asOf: current.updated_at };
      }
    }

    try {
      const fresh = await fetchUpstream();
      await write(fresh);
      return { status: "fresh", data: fresh, asOf: new Date().toISOString() };
    } catch (err) {
      await releaseLease(admin, config.table, symbol);
      throw err;
    }
  }

  const row = await read();

  if (row && config.hasData(row) && row.updated_at) {
    const age = Date.now() - new Date(row.updated_at).getTime();
    const data = config.rowToData(row);
    if (age < config.ttlMs) {
      return { status: "fresh", data, asOf: row.updated_at };
    }
    // Stale - a real number, just old. Try to refresh it, but this
    // caller already has something to hand back regardless of who wins
    // the claim, so a failed upstream fetch here still returns the stale
    // data rather than an error.
    const claimResult = await claim(admin, config.table, symbol);
    if (claimResult === "leader") {
      try {
        return await populate();
      } catch {
        return { status: "stale", data, asOf: row.updated_at };
      }
    }
    return { status: "stale", data, asOf: row.updated_at };
  }

  // No data has ever been written for this symbol.
  const claimResult = await claim(admin, config.table, symbol);
  if (claimResult === "leader") {
    try {
      return await populate();
    } catch (err) {
      return { status: "unavailable", error: err instanceof Error ? err.message : "Failed to fetch data" };
    }
  }

  // Follower with nothing to show yet - re-read once in case the leader
  // finished in the (small) window since the first read.
  const recheck = await read();
  if (recheck && config.hasData(recheck) && recheck.updated_at) {
    return { status: "fresh", data: config.rowToData(recheck), asOf: recheck.updated_at };
  }
  if (recheck?.fetching_until && new Date(recheck.fetching_until) > new Date()) {
    return { status: "pending" };
  }
  return { status: "unavailable", error: "No data available yet for this symbol." };
}

export interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
}

const QUOTE_TTL_MS = 15_000;

interface QuoteRow {
  price: number | null;
  change: number | null;
  change_percent: number | null;
  updated_at: string | null;
  fetching_until: string | null;
}

export async function getCachedQuote(
  symbol: string,
  fetchUpstream: () => Promise<QuoteData>
): Promise<CacheState<QuoteData>> {
  return getSingleRowCached<QuoteRow, QuoteData>(
    symbol,
    {
      table: "symbol_quotes",
      selectColumns: "price, change, change_percent, updated_at, fetching_until",
      ttlMs: QUOTE_TTL_MS,
      hasData: (row) => row.price !== null,
      rowToData: (row) => ({ price: row.price!, change: row.change!, changePercent: row.change_percent! }),
      dataToWriteColumns: (data) => ({ price: data.price, change: data.change, change_percent: data.changePercent }),
    },
    fetchUpstream
  );
}

export interface ProfileData {
  name: string | null;
  industry: string | null;
  exchange: string | null;
  country: string | null;
  website: string | null;
  ipo: string | null;
  marketCap: number | null;
}

// 24h, unchanged from the old in-memory marketCapCache's TTL - market cap
// and the rest of the profile don't move intraday, and this is now one
// shared call instead of the two independent ones (stocks/route.ts's
// market-cap lookup, chat/route.ts's getCompanyProfile) that used to hit
// Finnhub's /stock/profile2 separately.
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;

interface ProfileRow {
  name: string | null;
  industry: string | null;
  exchange: string | null;
  country: string | null;
  website: string | null;
  ipo: string | null;
  market_cap: number | null;
  updated_at: string | null;
  fetching_until: string | null;
}

export async function getCachedProfile(
  symbol: string,
  fetchUpstream: () => Promise<ProfileData>
): Promise<CacheState<ProfileData>> {
  return getSingleRowCached<ProfileRow, ProfileData>(
    symbol,
    {
      table: "symbol_profiles",
      selectColumns: "name, industry, exchange, country, website, ipo, market_cap, updated_at, fetching_until",
      ttlMs: PROFILE_TTL_MS,
      // A profile row counts as populated once it has a name - market_cap
      // alone can legitimately be null for a real, fetched profile (not
      // every symbol reports one), so it can't be the "has data" signal.
      hasData: (row) => row.name !== null,
      rowToData: (row) => ({
        name: row.name,
        industry: row.industry,
        exchange: row.exchange,
        country: row.country,
        website: row.website,
        ipo: row.ipo,
        marketCap: row.market_cap,
      }),
      dataToWriteColumns: (data) => ({
        name: data.name,
        industry: data.industry,
        exchange: data.exchange,
        country: data.country,
        website: data.website,
        ipo: data.ipo,
        market_cap: data.marketCap,
      }),
    },
    fetchUpstream
  );
}

export interface DailyPricePoint {
  date: string;
  close: number;
  volume: number | null;
}

// Freshness here is not a TTL - it's the same question benchmark_prices
// already answers correctly: is our most recent stored date current. A
// literal "is today's date present" check reintroduces the exact weekend
// bug fixed in the benchmark route (Stage 5): markets are closed on a
// Sunday, so "today's bar" would never exist and every request would
// think it needs a fresh backfill forever. STALE_AFTER_DAYS covers a
// normal weekend-plus-a-holiday gap as still fresh.
const STALE_AFTER_DAYS = 4;

export async function getCachedDailyPrices(
  symbol: string,
  fetchUpstream: () => Promise<DailyPricePoint[]>
): Promise<CacheState<DailyPricePoint[]>> {
  const admin = createAdminClient();

  async function readLatest(): Promise<{ points: DailyPricePoint[]; latestDate: string | null }> {
    const { data } = await admin
      .from("symbol_daily_prices")
      .select("date, close, volume")
      .eq("symbol", symbol)
      .order("date", { ascending: true });
    const points: DailyPricePoint[] = (data ?? []).map((r) => ({ date: r.date, close: Number(r.close), volume: r.volume === null ? null : Number(r.volume) }));
    return { points, latestDate: points.length > 0 ? points[points.length - 1].date : null };
  }

  async function write(points: DailyPricePoint[]): Promise<void> {
    if (points.length === 0) return;
    await admin
      .from("symbol_daily_prices")
      .upsert(
        points.map((p) => ({ symbol, date: p.date, close: p.close, volume: p.volume })),
        { onConflict: "symbol,date" }
      );
  }

  function isFresh(points: DailyPricePoint[], latestDate: string | null): boolean {
    if (points.length === 0 || !latestDate) return false;
    const gapDays = (Date.now() - new Date(latestDate).getTime()) / (24 * 60 * 60 * 1000);
    return gapDays < STALE_AFTER_DAYS;
  }

  async function populate(): Promise<CacheState<DailyPricePoint[]>> {
    // Same ambiguity as getSingleRowCached's populate(): winning the
    // claim doesn't mean the data is still stale - another leader may
    // have already backfilled and released between our first read and
    // now. Don't burn an upstream call re-fetching what's already fresh.
    const current = await readLatest();
    if (isFresh(current.points, current.latestDate)) {
      await releaseLease(admin, "symbol_daily_prices_claims", symbol);
      return { status: "fresh", data: current.points, asOf: new Date().toISOString() };
    }

    try {
      const fresh = await fetchUpstream();
      await write(fresh);
      await releaseLease(admin, "symbol_daily_prices_claims", symbol);
      const { points } = await readLatest();
      return { status: "fresh", data: points, asOf: new Date().toISOString() };
    } catch (err) {
      await releaseLease(admin, "symbol_daily_prices_claims", symbol);
      throw err;
    }
  }

  const { points, latestDate } = await readLatest();

  if (isFresh(points, latestDate)) {
    return { status: "fresh", data: points, asOf: new Date().toISOString() };
  }

  const claimResult = await claim(admin, "symbol_daily_prices_claims", symbol);
  if (claimResult === "leader") {
    try {
      return await populate();
    } catch (err) {
      if (points.length > 0) {
        return { status: "stale", data: points, asOf: latestDate! };
      }
      return { status: "unavailable", error: err instanceof Error ? err.message : "Failed to fetch price history" };
    }
  }

  if (points.length > 0) {
    return { status: "stale", data: points, asOf: latestDate! };
  }

  const { data: claimRow } = await admin
    .from("symbol_daily_prices_claims")
    .select("fetching_until")
    .eq("symbol", symbol)
    .maybeSingle();
  if (claimRow?.fetching_until && new Date(claimRow.fetching_until) > new Date()) {
    return { status: "pending" };
  }
  return { status: "unavailable", error: "No price history available yet for this symbol." };
}

// ----------------------------------------------------------------------------
// ensureDailyPricesDeepCoverage: backfill for callers that need history
// older than what the normal 400-bar candles fetch guarantees
// ----------------------------------------------------------------------------
// getCachedDailyPrices' freshness check only asks "is our most recent bar
// current" - it says nothing about how far back the cache goes, so a
// symbol fetched recently for a chart can report "fresh" while still
// missing a position-episode window from further back than its last fetch
// happened to reach. This is a second, narrower question - "do we have a
// bar covering this specific date" - used by the decision scorecard's
// exit-vs-plan check, which needs real coverage of an arbitrary historical
// window, not just a recent one.
//
// Reuses the same claim/release lease as getCachedDailyPrices (same
// symbol_daily_prices_claims row) so a chart request and a scorecard
// backfill for the same symbol can never both be leader at once, and a
// deep backfill is single-flighted the same way a cold quote is - two
// users opening the scorecard for the same never-deep-fetched symbol at
// once still cost one upstream call, not two.
const DEEP_COVERAGE_FOLLOWER_RETRY_DELAYS_MS = [500, 1000, 1500];

export interface DailyPricesCoverage {
  covered: boolean;
  earliestDate: string | null;
}

async function readEarliestDate(admin: AdminClient, symbol: string): Promise<string | null> {
  const { data } = await admin
    .from("symbol_daily_prices")
    .select("date")
    .eq("symbol", symbol)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.date ?? null;
}

/**
 * Ensures symbol_daily_prices has a bar on or before sinceDate for symbol,
 * fetching a deep (multi-year) history via fetchDeepUpstream if not.
 * fetchDeepUpstream is expected to request a large outputsize (thousands of
 * bars, not the ~400 the candles route uses) - see
 * lib/decisionScorecard.ts's caller for the actual Twelve Data call.
 *
 * Returns { covered: false } rather than throwing when a concurrent leader
 * doesn't finish within the short follower retry window - the caller's
 * contract is "tell me honestly whether the data is there," not "block
 * until it is," matching this feature's explicit "no price data for this
 * window" state over a silent or hung result.
 */
export async function ensureDailyPricesDeepCoverage(
  symbol: string,
  sinceDate: string,
  fetchDeepUpstream: () => Promise<DailyPricePoint[]>
): Promise<DailyPricesCoverage> {
  const admin = createAdminClient();

  const earliest = await readEarliestDate(admin, symbol);
  if (earliest !== null && earliest <= sinceDate) {
    return { covered: true, earliestDate: earliest };
  }

  const claimResult = await claim(admin, "symbol_daily_prices_claims", symbol);

  if (claimResult === "leader") {
    try {
      const fresh = await fetchDeepUpstream();
      if (fresh.length > 0) {
        await admin
          .from("symbol_daily_prices")
          .upsert(
            fresh.map((p) => ({ symbol, date: p.date, close: p.close, volume: p.volume })),
            { onConflict: "symbol,date" }
          );
      }
      await releaseLease(admin, "symbol_daily_prices_claims", symbol);
      const newEarliest = await readEarliestDate(admin, symbol);
      return { covered: newEarliest !== null && newEarliest <= sinceDate, earliestDate: newEarliest };
    } catch (err) {
      await releaseLease(admin, "symbol_daily_prices_claims", symbol);
      throw err;
    }
  }

  // Follower: the leader (possibly a concurrent chart request, possibly
  // another user's scorecard load) is already fetching. Wait it out with
  // the same short bounded retry shape used client-side for pending
  // states, rather than either blocking indefinitely or claiming a second
  // lease of our own.
  for (const delay of DEEP_COVERAGE_FOLLOWER_RETRY_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const recheck = await readEarliestDate(admin, symbol);
    if (recheck !== null && recheck <= sinceDate) {
      return { covered: true, earliestDate: recheck };
    }
  }

  const finalEarliest = await readEarliestDate(admin, symbol);
  return { covered: finalEarliest !== null && finalEarliest <= sinceDate, earliestDate: finalEarliest };
}
