-- ============================================================================
-- AI Paper Trader — Stage 5: honest execution (spread + slippage) on trades
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0006.

-- ----------------------------------------------------------------------------
-- transactions: quoted price vs. actual fill, and what the gap cost
-- ----------------------------------------------------------------------------
-- price and total keep their existing meaning and existing check
-- constraints - they're just more honest going forward. Historically price
-- was the raw last-trade quote used verbatim as the fill price, with no
-- spread or slippage applied. From the first trade executed after this
-- ships in application code, price becomes the actual modeled fill (quote
-- adjusted for estimated spread and slippage), and total continues to be
-- shares * price, same formula, now computed against the honest number.
-- Existing rows are not retroactively reinterpreted or rewritten - they
-- simply predate execution modeling, which the three new columns below
-- being null on those rows records plainly.
--
-- quoted_price: the raw quote the user saw before spread/slippage were
-- applied - what price already was, pre-migration.
-- spread_cost, slippage_cost: dollar cost attributable to each effect,
-- kept separate rather than combined into one total so the UI can show
-- users the two apart ("$X to spread, $Y to slippage"), not just one
-- opaque number.
--
-- All three nullable with no default, all-or-nothing (see the constraint
-- below): a trade either has full execution detail or none. There's no
-- meaningful state where a trade has a quoted_price but no cost breakdown,
-- or a cost breakdown with no quoted_price it was computed from.
alter table public.transactions
  add column quoted_price numeric(14, 6) check (quoted_price >= 0),
  add column spread_cost numeric(14, 6) check (spread_cost >= 0),
  add column slippage_cost numeric(14, 6) check (slippage_cost >= 0);

alter table public.transactions
  add constraint transactions_execution_detail_all_or_nothing
  check (
    (quoted_price is null and spread_cost is null and slippage_cost is null)
    or (quoted_price is not null and spread_cost is not null and slippage_cost is not null)
  );

comment on column public.transactions.price is
  'The fill price - what the trade actually executed at. For trades recorded before honest-execution modeling shipped, this is the raw last-trade quote used verbatim (quoted_price is null on those rows). For trades after, this is the quote adjusted for estimated spread and slippage - see quoted_price for what the user actually saw before that adjustment.';

comment on column public.transactions.quoted_price is
  'The raw quote (last trade price) at order time, before estimated spread and slippage were applied to produce the fill price in the price column. Null on trades recorded before honest-execution modeling shipped - not backfilled, since there is no real quote to recover for those.';

comment on column public.transactions.spread_cost is
  'Estimated dollar cost attributable to the bid/ask spread on this trade. This data tier has no real bid/ask, so this is a modeled estimate, not an exchange-quoted spread. Null on trades recorded before execution-cost modeling covered this trade.';

comment on column public.transactions.slippage_cost is
  'Estimated dollar cost attributable to order-size slippage on this trade, modeled as a heuristic against available liquidity data (not real order-book depth). Null on trades recorded before execution-cost modeling covered this trade.';

-- ----------------------------------------------------------------------------
-- execute_trade: accept and record the execution detail
-- ----------------------------------------------------------------------------
-- This is NOT a create or replace of the 0002 version, even though it
-- looks like one below - it can't be. Postgres identifies a function by
-- name AND parameter signature together; create or replace only replaces
-- when the signature matches exactly. Adding three parameters changes the
-- signature, so create or replace here would silently create a SECOND,
-- overloaded execute_trade (4-arg and 7-arg both existing at once) rather
-- than replacing the first. PortfolioContext's call - four named
-- arguments - would then match both overloads (the 7-arg one via its
-- trailing defaults), and Postgres refuses to guess: every trade would
-- fail with "function execute_trade is not unique."
--
-- The old 4-arg signature has to be dropped explicitly first. `if exists`
-- keeps this migration safe to re-run - the second run finds nothing left
-- at that signature and no-ops instead of erroring.
drop function if exists public.execute_trade(text, text, numeric, numeric);

-- A genuine drop-and-create, not a replace, has one more consequence: the
-- 0002 grant does NOT carry over. Grants are tied to the function's OID,
-- and dropping the function drops its grants with it - only a true
-- same-signature replace (like reset_portfolio in 0006) preserves them.
-- The grant is re-issued explicitly below, after the new definition, for
-- exactly this reason. Skipping it would mean trades fail with a
-- permissions error instead of the overload error above - a different
-- failure, not a smaller one.
--
-- The three new parameters default to null and are purely additive -
-- existing callers, and any trade executed before application code is
-- updated to compute and pass them, keep working exactly as before,
-- producing the same null-execution-detail rows historical trades already
-- have. p_price is unchanged in meaning to this function - it has always
-- been "the price this trade executes at"; what changes is what
-- application code now computes and passes as that price.
create or replace function public.execute_trade(
  p_symbol text,
  p_action text,      -- 'buy' or 'sell'
  p_shares numeric,
  p_price numeric,
  p_quoted_price numeric default null,
  p_spread_cost numeric default null,
  p_slippage_cost numeric default null
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

  insert into transactions (
    portfolio_id, symbol, type, shares, price, total,
    quoted_price, spread_cost, slippage_cost
  )
  values (
    v_portfolio_id, v_symbol, p_action, p_shares, p_price, v_cost,
    p_quoted_price, p_spread_cost, p_slippage_cost
  );

  return (select cash from portfolios where id = v_portfolio_id);
end;
$$;

-- Re-issued explicitly - see the comment above the drop statement for why
-- this doesn't survive on its own here, unlike reset_portfolio in 0006.
grant execute on function public.execute_trade(
  text, text, numeric, numeric, numeric, numeric, numeric
) to authenticated;
