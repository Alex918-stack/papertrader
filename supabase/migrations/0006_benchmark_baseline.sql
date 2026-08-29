-- ============================================================================
-- AI Paper Trader — Stage 5: benchmark baseline (you vs. the S&P 500)
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0005.

-- ----------------------------------------------------------------------------
-- benchmark_prices: a shared, server-populated cache of SPY daily closes
-- ----------------------------------------------------------------------------
-- Not per-user - every account is compared against the same index, so one
-- shared series serves everyone instead of every portfolio re-fetching (and
-- re-paying the rate limit for) the same historical data. SPY is used as
-- the S&P 500 proxy, same as the AI chat tool's existing market-overview
-- feature (app/api/chat/route.ts, MARKET_INDEX_PROXIES) already does.
--
-- numeric(14, 6) matches the precision already used for transactions.price
-- and holdings.avg_cost - no reason for the benchmark series to carry more
-- or less precision than the trade data it's compared against.
create table public.benchmark_prices (
  date date primary key,
  close numeric(14, 6) not null check (close > 0)
);

comment on table public.benchmark_prices is
  'Daily SPY closing prices, used as the S&P 500 proxy for the "you vs. the market" comparison. Populated server-side only - see the RLS section below.';

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- This table has no insert, update, or delete policy at all, deliberately -
-- with RLS enabled and none defined, every client role (anon and
-- authenticated alike) is fully blocked from writing to it, full stop. The
-- anon key ships inside the client bundle; without this, anyone holding it
-- could overwrite SPY's history and silently poison every user's benchmark
-- comparison with no visible error anywhere.
--
-- Population instead happens exclusively from a server-side route using the
-- Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY - already present in
-- .env.local, not yet used by any code). That role bypasses RLS by Postgres
-- privilege, not by a policy, so it needs none of the policies below to
-- write. No security definer function is introduced for this: the
-- service-role route can write directly, and keeping the write path out of
-- Postgres entirely means there's no grant surface here that could
-- accidentally end up callable by 'authenticated'.
--
-- Select is open to everyone, anon included: these are public SPY closing
-- prices, not user data, so there's no confidentiality reason to gate reads
-- behind sign-in - a signed-out visitor should be able to see the same
-- benchmark comparison a signed-in user does.
alter table public.benchmark_prices enable row level security;

create policy "benchmark_prices_select_all" on public.benchmark_prices
  for select
  using (true);

-- ----------------------------------------------------------------------------
-- portfolios.benchmark_start_date
-- ----------------------------------------------------------------------------
-- profiles.created_at is the wrong anchor for the benchmark comparison:
-- Reset Portfolio restores cash to $100,000 without moving created_at, so a
-- reset account would measure its own performance from the reset while the
-- benchmark kept measuring from signup - two different starting lines being
-- compared as if they were one. This column is that anchor instead, and
-- reset_portfolio (redefined below) moves it forward on every reset, the
-- same way it already resets cash back to the column default.
--
-- default now() covers "set on creation" for free: handle_new_user (0001,
-- redefined in 0002) already inserts a portfolios row naming no columns
-- besides user_id, so this new column falls through to its default exactly
-- like cash already does - no trigger change needed.
alter table public.portfolios
  add column benchmark_start_date timestamptz not null default now();

comment on column public.portfolios.benchmark_start_date is
  'When the current cash baseline started - signup for an untouched account, or the moment of the most recent Reset Portfolio. Not profiles.created_at: that never moves, so it stops being a fair benchmark anchor the instant an account is reset.';

-- Backfill for existing portfolios only: none of them have been touched by
-- this column before, and none of them can have been reset "since" a
-- benchmark_start_date that didn't exist yet - so profiles.created_at is
-- still the historically correct anchor for every row that exists right
-- now. This is a one-time backfill of a brand-new column, not a retroactive
-- re-pricing of anything that already happened - transactions.price and
-- .total are untouched by this migration.
update public.portfolios
set benchmark_start_date = profiles.created_at
from public.profiles
where profiles.id = portfolios.user_id;

-- ----------------------------------------------------------------------------
-- benchmark_trading_date: the one correct place to turn a timestamp into a
-- benchmark_prices.date lookup key
-- ----------------------------------------------------------------------------
-- benchmark_start_date is a timestamptz (an instant); benchmark_prices.date
-- is a calendar date in US market terms (which close belongs to which
-- trading day). Those are not the same axis, and the conversion between
-- them is not "cast to date" - a timestamptz cast to date takes the date in
-- whatever timezone the session happens to be running in, which for a
-- server-side connection is typically UTC. UTC is 4-5 hours ahead of
-- America/New_York, so anyone who signs up (or resets) after ~8pm ET gets
-- cast to the following calendar day in UTC and would silently get matched
-- against tomorrow's SPY close instead of today's - wrong, and not in a
-- way that throws or shows up in a spot check, just quietly off for
-- anyone who happened to trade in the evening.
--
-- No comparison query exists yet that calls this - that's the next step,
-- not this migration. It's defined here, now, so that whenever that query
-- is written, the correct conversion already exists as the one place to
-- call rather than something to get right (or wrong) again from scratch.
--
-- stable, not immutable: at time zone 'America/New_York' depends on the
-- zone's DST rules, which come from the server's tzdata and can in
-- principle be updated (e.g. a historical rule correction) - so the same
-- input is not guaranteed to map to the same output for all time, which is
-- what immutable actually promises. default_starting_cash() (0002) is a
-- true constant and immutable is correct there; this isn't the same case.
create or replace function public.benchmark_trading_date(p_ts timestamptz)
returns date
language sql
stable
as $$
  select (p_ts at time zone 'America/New_York')::date;
$$;

grant execute on function public.benchmark_trading_date to authenticated;

-- ----------------------------------------------------------------------------
-- reset_portfolio: also reset the benchmark anchor
-- ----------------------------------------------------------------------------
-- Redefines the 0002 version. create or replace preserves the function's
-- existing grant (to authenticated), so that doesn't need repeating here.
-- Everything else - security definer to get past transactions' delete-less
-- RLS, the explicit where user_id = auth.uid() scoping, deleting holdings
-- and transactions - is unchanged; the only difference is one more column
-- in the update.
create or replace function public.reset_portfolio()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
begin
  select id into v_portfolio_id from portfolios where user_id = auth.uid();

  if v_portfolio_id is null then
    raise exception 'Portfolio not found';
  end if;

  update portfolios
  set cash = default, benchmark_start_date = default
  where id = v_portfolio_id;
  delete from holdings where portfolio_id = v_portfolio_id;
  delete from transactions where portfolio_id = v_portfolio_id;
end;
$$;
