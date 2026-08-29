-- ============================================================================
-- AI Paper Trader — Stage 7: shared market-data cache + rate limiting
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0009.
--
-- Problem: Twelve Data allows 8 requests/minute and 800/day, shared across
-- every user of this app, not per-user. Finnhub has more headroom but is
-- the same shape of problem. The in-memory caches in app/api/stocks/route.ts
-- (10s quotes, 6h candles, 24h market cap) don't survive a real deployment:
-- every Vercel serverless instance has its own memory, instances churn
-- constantly, and 30 people hitting a cold dashboard at once means 30
-- independent cache misses each firing their own upstream call - an 8/min
-- limit is gone in the first second.
--
-- This migration only adds tables + RLS. The read/claim/write logic that
-- actually uses them (app/api/stocks/route.ts, plus app/api/chat/route.ts's
-- getCompanyProfile) is application code for a follow-up change, not this
-- migration - same division of labor as 0006's benchmark_prices, whose
-- population logic lives in lib/benchmarkPrices.ts, not in SQL.

-- ----------------------------------------------------------------------------
-- Three caches, five tables
-- ----------------------------------------------------------------------------
-- symbol_quotes and symbol_profiles are naturally one row per symbol - a
-- quote is a single current snapshot, so its lease (fetching_until) lives
-- directly on that same row: whoever wins the upsert-claim below is the
-- leader, everyone else reads whatever's already there.
--
-- symbol_daily_prices is a genuinely different shape: one row per
-- (symbol, date), and a single Twelve Data call backfills many days at
-- once. There's no single row a per-symbol lease could live on without
-- either faking a sentinel date (fragile - a NULL-date row mixed into a
-- real calendar table invites bugs in anything that does max(date) or
-- iterates real bars) or leaving concurrent backfills unprotected. So it
-- gets a tiny companion table, symbol_daily_prices_claims, holding nothing
-- but the lease - the actual bars stay exactly benchmark_prices-shaped.
-- Freshness for daily bars is answered by the data itself (does the most
-- recent stored date look current), the same way benchmark_prices already
-- works - not by a TTL column here.
create table public.symbol_daily_prices (
  symbol text not null,
  date date not null,
  close numeric(14, 6) not null check (close > 0),
  volume numeric(20, 2),
  primary key (symbol, date)
);

comment on table public.symbol_daily_prices is
  'Daily close/volume per symbol, shared across every user - same reasoning as benchmark_prices, generalized to any symbol instead of just SPY. Populated server-side only.';

create table public.symbol_daily_prices_claims (
  symbol text primary key,
  fetching_until timestamptz
);

comment on table public.symbol_daily_prices_claims is
  'Single-flight lease for backfilling symbol_daily_prices - one row per symbol, holding nothing but "is a backfill in flight." Not market data itself; see the RLS section below for why it is not publicly readable.';

create table public.symbol_quotes (
  symbol text primary key,
  price numeric(14, 6) check (price is null or price > 0),
  change numeric(14, 6),
  change_percent numeric(10, 4),
  updated_at timestamptz,
  fetching_until timestamptz
);

comment on table public.symbol_quotes is
  'Latest quote per symbol, shared across every user. price/change/change_percent/updated_at are null on a row that exists only as an active claim (first-ever fetch for that symbol still in flight) - see the pending/fresh/stale/unavailable note below.';

create table public.symbol_profiles (
  symbol text primary key,
  name text,
  industry text,
  exchange text,
  country text,
  website text,
  ipo date,
  market_cap numeric(20, 2) check (market_cap is null or market_cap > 0),
  updated_at timestamptz,
  fetching_until timestamptz
);

comment on table public.symbol_profiles is
  'Company profile + market cap per symbol, unified into one table because they are already one upstream call (Finnhub /stock/profile2) - app/api/stocks/route.ts''s market-cap lookup and app/api/chat/route.ts''s getCompanyProfile currently fetch and cache this independently, doubling a call that should happen once. Both read this table once the follow-up route change lands.';

-- ----------------------------------------------------------------------------
-- The claim pattern (documented here, used from application code)
-- ----------------------------------------------------------------------------
-- A bare conditional UPDATE ("where fetching_until is null or expired")
-- matches nothing on a cold cache - no row exists yet, so every concurrent
-- request becomes a "follower" with nothing to fall back to and nobody
-- ever becomes the leader who actually fetches. That is exactly the demo's
-- worst moment (cold cache, 30 simultaneous requests), so the claim has to
-- be upsert-shaped, handling "no row" and "expired lease" the same way:
--
--   insert into symbol_quotes (symbol, fetching_until)
--   values ($1, now() + interval '8 seconds')
--   on conflict (symbol) do update
--     set fetching_until = now() + interval '8 seconds'
--     where symbol_quotes.fetching_until is null
--        or symbol_quotes.fetching_until < now()
--   returning symbol;
--
-- A row returned means this caller is the leader: go fetch upstream, then
-- write the real data AND explicitly clear the lease in the same
-- statement (set fetching_until = null - not left to be an incidental
-- side effect of overwriting the row, so a future write that only touches
-- some columns can't accidentally leave a stale lease behind):
--
--   update symbol_quotes
--   set price = $2, change = $3, change_percent = $4,
--       updated_at = now(), fetching_until = null
--   where symbol = $1;
--
-- No row returned means someone else already holds the lease - read
-- whatever is currently in the row instead of touching upstream. This is
-- an atomic single statement each time, so it works correctly over plain
-- PostgREST/supabase-js with no held connection or session-scoped lock
-- (pg_advisory_lock does not survive across the Node-side upstream fetch
-- happening between an acquire and release call over stateless HTTP - not
-- used here for that reason). The lease expires on its own after 8s if the
-- leader's fetch fails or the function is killed mid-request, so a stuck
-- claim self-heals without needing explicit cleanup - the next request
-- just re-claims it.
--
-- Same shape for symbol_daily_prices_claims and symbol_profiles.
--
-- What a reader does with the result is four states, not two:
--   FRESH       - data present, within its freshness window.
--   STALE       - data present, past its freshness window. Serve it
--                 anyway, marked with its real updated_at, rather than
--                 blocking or showing nothing - a real number that is a
--                 bit old beats no number.
--   PENDING     - no data yet (updated_at is null) but fetching_until is
--                 in the future - this is the cold-cache case a bare
--                 UPDATE would have broken. Not an error: the client
--                 should retry shortly, not render a failure.
--   UNAVAILABLE - no data, and the fetch that was supposed to produce it
--                 failed (the leader's own upstream call errored, or
--                 nothing has ever populated this symbol and no lease is
--                 active). Only state that should render as a real error.
-- This classification is read-path logic (it depends on a TTL that
-- differs per table and changes with "now"), so it lives in the route
-- handler that reads these tables, not in SQL here.

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- symbol_daily_prices, symbol_quotes, symbol_profiles: same pattern as
-- benchmark_prices (0006) - RLS enabled, one open select policy, no
-- insert/update/delete policy at all, so every client role (anon and
-- authenticated alike) is fully blocked from writing regardless of what
-- the anon key in the client bundle can see. This is public market data,
-- same as benchmark_prices - a signed-out visitor should see the same
-- quote a signed-in user does. All writes happen server-side via the
-- service-role client (lib/supabase/admin.ts), which bypasses RLS by
-- Postgres role privilege, not by a policy.
alter table public.symbol_daily_prices enable row level security;
alter table public.symbol_quotes enable row level security;
alter table public.symbol_profiles enable row level security;

create policy "symbol_daily_prices_select_all" on public.symbol_daily_prices
  for select
  using (true);

create policy "symbol_quotes_select_all" on public.symbol_quotes
  for select
  using (true);

create policy "symbol_profiles_select_all" on public.symbol_profiles
  for select
  using (true);

-- symbol_daily_prices_claims: RLS enabled, NO policies at all - not even
-- select. Unlike the three tables above, this holds no market data a
-- client ever needs to read; it is purely internal coordination state (a
-- lease timestamp). No product reason to expose it, and the "no policy =
-- fully blocked" stance matters more here than it did for benchmark_prices:
-- this table has a mutable lease a malicious write could forge to freeze
-- the whole cache (claim it, never populate it, never let it expire early).
-- Blocking every client role removes that surface entirely rather than
-- relying on a well-behaved client to only ever read or write it correctly.
alter table public.symbol_daily_prices_claims enable row level security;

-- ----------------------------------------------------------------------------
-- rate_limit_cooldowns: shared per-user cooldown state
-- ----------------------------------------------------------------------------
-- Replaces two in-memory Maps that have the same problem as the market-data
-- caches did - app/api/chat/route.ts's lastRequestTime resets on every
-- deploy and does not share across serverless instances, and
-- app/api/journal/critique/route.ts has no rate limiting at all today.
-- One shared table, bucket distinguishing use sites ('chat', 'critique',
-- more later) so this does not need to be redesigned per endpoint - same
-- upsert-claim shape as the market-data tables:
--
--   insert into rate_limit_cooldowns (bucket, key, requested_at)
--   values ($1, $2, now())
--   on conflict (bucket, key) do update
--     set requested_at = now()
--     where rate_limit_cooldowns.requested_at < now() - interval '2 seconds'
--   returning key;
--
-- A row returned means the caller is allowed to proceed; no row means
-- they are still inside their own cooldown window and should be rejected.
--
-- key is a plain text column deliberately, not just "the user's email" -
-- the chat cooldown today buckets every signed-out visitor under the
-- literal string "anonymous", so one guest currently exhausts the cooldown
-- for every other guest. The follow-up route change keys guests by request
-- IP instead; this column already accommodates either shape without a
-- schema change.
create table public.rate_limit_cooldowns (
  bucket text not null,
  key text not null,
  requested_at timestamptz not null default now(),
  primary key (bucket, key)
);

comment on table public.rate_limit_cooldowns is
  'Shared per-user/per-bucket cooldown state for rate-limited endpoints (chat, critique). Not public data - see RLS below.';

-- RLS enabled, NO policies at all - same reasoning as
-- symbol_daily_prices_claims, stronger here: this table doubles as the
-- thing standing between the app and burning through the Gemini/Finnhub
-- budget, so it gets zero client access rather than a read policy nobody
-- actually needs. Every check-and-claim happens server-side via the
-- service-role client.
alter table public.rate_limit_cooldowns enable row level security;
