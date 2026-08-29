-- ============================================================================
-- AI Paper Trader — Stage 3: atomic portfolio functions
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001_init_schema.sql. Adds the
-- Postgres functions the app calls directly via supabase.rpc(...) - no API
-- route in between, RLS is what makes that safe.

-- ----------------------------------------------------------------------------
-- Single source of truth for the starting cash balance
-- ----------------------------------------------------------------------------
-- Previously 100000.00 was a literal duplicated in three places (the column
-- default, handle_new_user, and the new reset_portfolio below). Every other
-- reference now points at the column's own default via `= default`, so this
-- function is the only place the number itself is written.
create or replace function public.default_starting_cash()
returns numeric
language sql
immutable
as $$
  select 100000.00::numeric;
$$;

grant execute on function public.default_starting_cash to authenticated;

alter table public.portfolios
  alter column cash set default public.default_starting_cash();

-- handle_new_user no longer names a cash value at all - omitting the column
-- means the insert falls through to the column default above.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.portfolios (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- execute_trade: the one atomic entry point for buying and selling
-- ----------------------------------------------------------------------------
-- security invoker (not definer): runs as the calling user, so auth.uid()
-- is genuinely theirs and RLS still applies underneath the explicit
-- `where user_id = auth.uid()` below - two independent layers agreeing,
-- not one pretending to stand in for the other. Every effect below happens
-- in the one implicit transaction a Postgres function body already is: if
-- any raise exception fires, everything in this call rolls back, including
-- effects earlier in the same call. "Debited cash but didn't record the
-- holding" is not a bug to avoid here, it's a state the database can't reach.
create or replace function public.execute_trade(
  p_symbol text,
  p_action text,      -- 'buy' or 'sell'
  p_shares numeric,
  p_price numeric
)
returns numeric        -- new cash balance
language plpgsql
security invoker
as $$
declare
  v_portfolio_id uuid;
  v_cash numeric;
  v_symbol text := upper(p_symbol);
  v_existing_shares numeric;
  v_existing_avg_cost numeric;
  v_cost numeric := p_shares * p_price;
  v_new_shares numeric;
begin
  if p_shares <= 0 then
    raise exception 'Shares must be positive';
  end if;
  if p_action not in ('buy', 'sell') then
    raise exception 'Invalid action: %', p_action;
  end if;

  -- Locks this user's portfolio row for the rest of the transaction, so two
  -- trades fired back-to-back (a double-click, or the AI executing a
  -- multi-trade plan) can't both read the same starting cash and overspend.
  select id, cash into v_portfolio_id, v_cash
  from portfolios where user_id = auth.uid() for update;

  if v_portfolio_id is null then
    raise exception 'Portfolio not found';
  end if;

  select shares, avg_cost into v_existing_shares, v_existing_avg_cost
  from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol
  for update;

  if p_action = 'buy' then
    if v_cost > v_cash then
      raise exception 'Insufficient cash';
    end if;

    v_new_shares := coalesce(v_existing_shares, 0) + p_shares;

    insert into holdings (portfolio_id, symbol, shares, avg_cost)
    values (
      v_portfolio_id, v_symbol, v_new_shares,
      case when v_existing_shares is null then p_price
           else (v_existing_avg_cost * v_existing_shares + v_cost) / v_new_shares
      end
    )
    on conflict (portfolio_id, symbol) do update
      set shares = excluded.shares, avg_cost = excluded.avg_cost, updated_at = now();

    update portfolios set cash = cash - v_cost where id = v_portfolio_id;
  else
    if v_existing_shares is null or v_existing_shares < p_shares then
      raise exception 'Insufficient shares';
    end if;

    v_new_shares := v_existing_shares - p_shares;

    -- shares has check (shares > 0) - a fully-closed position must be
    -- deleted, never updated to 0.
    if v_new_shares = 0 then
      delete from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol;
    else
      update holdings set shares = v_new_shares, updated_at = now()
      where portfolio_id = v_portfolio_id and symbol = v_symbol;
    end if;

    update portfolios set cash = cash + v_cost where id = v_portfolio_id;
  end if;

  insert into transactions (portfolio_id, symbol, type, shares, price, total)
  values (v_portfolio_id, v_symbol, p_action, p_shares, p_price, v_cost);

  return (select cash from portfolios where id = v_portfolio_id);
end;
$$;

grant execute on function public.execute_trade to authenticated;

-- ----------------------------------------------------------------------------
-- reset_portfolio: wipe back to a fresh account
-- ----------------------------------------------------------------------------
-- security definer, unlike execute_trade above, and that's deliberate rather
-- than inconsistent: transactions has no delete policy by design (stage 1 -
-- it's meant to be an append-only audit trail). Under security invoker, the
-- delete from transactions below would silently match zero rows - no error,
-- just a "successful" reset that quietly leaves the entire trade history
-- behind. security definer runs as the function owner, who (as the table
-- owner) isn't subject to RLS, so the delete actually takes effect. auth.uid()
-- still correctly reflects the real calling user inside a definer function -
-- it reads from the session's JWT claims, not the executing role - so the
-- explicit `where user_id = auth.uid()` scoping is still what's actually
-- doing the authorization here, same as handle_new_user above.
--
-- This intentionally does NOT add a delete policy to transactions instead.
-- A deliberate, atomic, all-or-nothing reset and editing or removing a
-- single trade are meant to stay two different things - only this narrow,
-- fully-scoped function can ever remove a transaction row.
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

  update portfolios set cash = default where id = v_portfolio_id;
  delete from holdings where portfolio_id = v_portfolio_id;
  delete from transactions where portfolio_id = v_portfolio_id;
end;
$$;

grant execute on function public.reset_portfolio to authenticated;

-- ----------------------------------------------------------------------------
-- import_legacy_portfolio: one-time Redis -> Postgres migration
-- ----------------------------------------------------------------------------
-- security invoker is sufficient here - unlike reset_portfolio, this only
-- ever inserts (holdings, transactions) and updates (portfolios.cash),
-- all of which the existing RLS policies already permit for the owning user.
-- Returns true if it imported, false if it safely skipped because the
-- portfolio already had real data - both are success outcomes for the
-- caller, distinct from an exception, which means something actually broke.
create or replace function public.import_legacy_portfolio(
  p_cash numeric,
  p_holdings jsonb,
  p_transactions jsonb
)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_portfolio_id uuid;
  v_current_cash numeric;
  v_holding_count int;
  v_transaction_count int;
  h jsonb;
  t jsonb;
begin
  select id, cash into v_portfolio_id, v_current_cash
  from portfolios where user_id = auth.uid() for update;

  if v_portfolio_id is null then
    raise exception 'Portfolio not found';
  end if;

  select count(*) into v_holding_count from holdings where portfolio_id = v_portfolio_id;
  select count(*) into v_transaction_count from transactions where portfolio_id = v_portfolio_id;

  -- Never overwrite a portfolio that already has real activity - "untouched"
  -- means no holdings, no transactions, and cash still at the default.
  if v_holding_count > 0 or v_transaction_count > 0
     or v_current_cash <> public.default_starting_cash() then
    return false;
  end if;

  update portfolios set cash = p_cash where id = v_portfolio_id;

  for h in select * from jsonb_array_elements(p_holdings)
  loop
    insert into holdings (portfolio_id, symbol, shares, avg_cost)
    values (
      v_portfolio_id,
      upper(h ->> 'symbol'),
      (h ->> 'shares')::numeric,
      (h ->> 'avgCost')::numeric
    )
    on conflict (portfolio_id, symbol) do update
      set shares = excluded.shares, avg_cost = excluded.avg_cost, updated_at = now();
  end loop;

  -- executed_at is set explicitly from the legacy record on every row here.
  -- The column defaults to now(), which is exactly wrong for imported data -
  -- without this, every imported trade would be stamped with the import
  -- time and the real chronology would be gone the moment the Redis key
  -- is deleted afterward.
  for t in select * from jsonb_array_elements(p_transactions)
  loop
    insert into transactions (portfolio_id, symbol, type, shares, price, total, executed_at)
    values (
      v_portfolio_id,
      upper(t ->> 'symbol'),
      lower(t ->> 'type'),
      (t ->> 'shares')::numeric,
      (t ->> 'price')::numeric,
      (t ->> 'total')::numeric,
      (t ->> 'executed_at')::timestamptz
    );
  end loop;

  return true;
end;
$$;

grant execute on function public.import_legacy_portfolio to authenticated;
