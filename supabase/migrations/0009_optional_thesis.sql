-- ============================================================================
-- AI Paper Trader — Stage 6.1: thesis becomes optional
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0008.
--
-- Product change: a thesis is no longer required to open a position.
-- Episode creation itself stays unconditional either way - see
-- execute_trade below - because most of what the decision-quality
-- scorecard needs (win rate, holding period, over-trading, whether
-- winners get cut short and losers get held too long) only needs episode
-- boundaries, not a thesis. Making episode creation conditional on writing
-- one would throw all of that away for exactly the trades most likely to
-- skip the form.

-- ----------------------------------------------------------------------------
-- position_episodes: drop NOT NULL, keep "non-empty if present"
-- ----------------------------------------------------------------------------
-- Each check constraint is dropped and re-added rather than altered in
-- place - Postgres has no "alter check constraint," only drop-and-recreate.
-- The names below (<table>_<column>_check) are Postgres's own deterministic
-- naming for an unnamed inline column check, exactly what 0008's
-- `create table` produced for these three columns.
alter table public.position_episodes
  alter column thesis_why_this drop not null,
  alter column thesis_why_now drop not null,
  alter column thesis_invalidation drop not null;

alter table public.position_episodes
  drop constraint if exists position_episodes_thesis_why_this_check;
alter table public.position_episodes
  add constraint position_episodes_thesis_why_this_check
  check (thesis_why_this is null or length(trim(thesis_why_this)) > 0);

alter table public.position_episodes
  drop constraint if exists position_episodes_thesis_why_now_check;
alter table public.position_episodes
  add constraint position_episodes_thesis_why_now_check
  check (thesis_why_now is null or length(trim(thesis_why_now)) > 0);

alter table public.position_episodes
  drop constraint if exists position_episodes_thesis_invalidation_check;
alter table public.position_episodes
  add constraint position_episodes_thesis_invalidation_check
  check (thesis_invalidation is null or length(trim(thesis_invalidation)) > 0);

-- ----------------------------------------------------------------------------
-- execute_trade: stop requiring a thesis to open - a true replace this time
-- ----------------------------------------------------------------------------
-- Unlike 0007 -> 0008 (which added parameters and needed an explicit drop
-- first), this signature is byte-for-byte identical to 0008's - same 12
-- parameters, same names, same types, same order. Only the
-- raise-on-missing-thesis check inside the body is gone. Same name + same
-- signature is what create or replace treats as a genuine replace, which
-- is what actually preserves the existing grant automatically - confirmed
-- by diffing this parameter list against 0008's line by line, not assumed.
create or replace function public.execute_trade(
  p_symbol text,
  p_action text,      -- 'buy' or 'sell'
  p_shares numeric,
  p_price numeric,
  p_quoted_price numeric default null,
  p_spread_cost numeric default null,
  p_slippage_cost numeric default null,
  p_thesis_why_this text default null,
  p_thesis_why_now text default null,
  p_thesis_invalidation text default null,
  p_thesis_invalidation_price numeric default null,
  p_note text default null
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
  v_episode_id uuid;
begin
  if p_shares <= 0 then
    raise exception 'Shares must be positive';
  end if;
  if p_action not in ('buy', 'sell') then
    raise exception 'Invalid action: %', p_action;
  end if;

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

    if v_existing_shares is null then
      -- Thesis is optional now - whatever was passed (including all null)
      -- is recorded as-is. Episode creation itself is never conditional
      -- on it - see the comment at the top of this migration.
      insert into position_episodes (
        portfolio_id, symbol, opened_at,
        thesis_why_this, thesis_why_now, thesis_invalidation, thesis_invalidation_price
      )
      values (
        v_portfolio_id, v_symbol, now(),
        p_thesis_why_this, p_thesis_why_now, p_thesis_invalidation, p_thesis_invalidation_price
      )
      returning id into v_episode_id;
    else
      select id into v_episode_id
      from position_episodes
      where portfolio_id = v_portfolio_id and symbol = v_symbol and closed_at is null;
    end if;
  else
    if v_existing_shares is null or v_existing_shares < p_shares then
      raise exception 'Insufficient shares';
    end if;

    v_new_shares := v_existing_shares - p_shares;

    if v_new_shares = 0 then
      delete from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol;
    else
      update holdings set shares = v_new_shares, updated_at = now()
      where portfolio_id = v_portfolio_id and symbol = v_symbol;
    end if;

    update portfolios set cash = cash + v_cost where id = v_portfolio_id;

    select id into v_episode_id
    from position_episodes
    where portfolio_id = v_portfolio_id and symbol = v_symbol and closed_at is null;

    if v_episode_id is not null and v_new_shares = 0 then
      update position_episodes set closed_at = now() where id = v_episode_id;
    end if;
  end if;

  insert into transactions (
    portfolio_id, symbol, type, shares, price, total,
    quoted_price, spread_cost, slippage_cost, episode_id, note
  )
  values (
    v_portfolio_id, v_symbol, p_action, p_shares, p_price, v_cost,
    p_quoted_price, p_spread_cost, p_slippage_cost, v_episode_id, p_note
  );

  return (select cash from portfolios where id = v_portfolio_id);
end;
$$;
-- No grant re-issued here, deliberately - see the comment above the
-- function: this is a genuine same-signature replace, so the grant from
-- 0008 survives on its own. Verified live after applying (see the summary
-- alongside this migration), not just assumed from the theory.

-- ----------------------------------------------------------------------------
-- prevent_position_episode_review_overwrite: also protect the thesis columns
-- ----------------------------------------------------------------------------
-- The missing UPDATE grant on the thesis columns (0008) already blocks
-- `authenticated` from touching them at all, in a single statement, before
-- this trigger even runs - that alone is sufficient against the client.
-- This adds a second, independent layer against anything the grant doesn't
-- bind (a direct admin/SQL-editor update, or a future migration that
-- widens the grant without noticing the immutability implication) - the
-- same "two independent layers agreeing, not one pretending to stand in
-- for the other" reasoning execute_trade's own comments already use for
-- RLS-plus-auth.uid() scoping, applied here to grant-plus-trigger instead.
--
-- Stricter than the closed_at/exit_reflection/critique checks below it:
-- those allow exactly one null -> value transition (the legitimate close,
-- the legitimate reflection, the legitimate critique). Thesis fields allow
-- none at all - null at open means null forever, so ANY difference between
-- old and new is rejected, including the first null -> value transition
-- that's fine for those other columns.
create or replace function public.prevent_position_episode_review_overwrite()
returns trigger
language plpgsql
as $$
begin
  if new.thesis_why_this is distinct from old.thesis_why_this then
    raise exception 'thesis_why_this cannot be changed after the episode is created';
  end if;
  if new.thesis_why_now is distinct from old.thesis_why_now then
    raise exception 'thesis_why_now cannot be changed after the episode is created';
  end if;
  if new.thesis_invalidation is distinct from old.thesis_invalidation then
    raise exception 'thesis_invalidation cannot be changed after the episode is created';
  end if;
  if new.thesis_invalidation_price is distinct from old.thesis_invalidation_price then
    raise exception 'thesis_invalidation_price cannot be changed after the episode is created';
  end if;

  if old.closed_at is null and new.closed_at is not null then
    if exists (
      select 1 from holdings
      where holdings.portfolio_id = new.portfolio_id and holdings.symbol = new.symbol
    ) then
      raise exception 'Cannot close an episode while holdings still exist for this symbol';
    end if;
  elsif old.closed_at is not null and new.closed_at is distinct from old.closed_at then
    raise exception 'closed_at is set once and cannot be changed';
  end if;
  if old.exit_reflection is not null and new.exit_reflection is distinct from old.exit_reflection then
    raise exception 'exit_reflection is set once and cannot be changed';
  end if;
  if old.exit_reflection_note is not null and new.exit_reflection_note is distinct from old.exit_reflection_note then
    raise exception 'exit_reflection_note is set once and cannot be changed';
  end if;
  if old.critique is not null and new.critique is distinct from old.critique then
    raise exception 'critique is set once and cannot be changed';
  end if;
  if old.critique_generated_at is not null and new.critique_generated_at is distinct from old.critique_generated_at then
    raise exception 'critique_generated_at is set once and cannot be changed';
  end if;
  return new;
end;
$$;
-- The trigger itself (position_episodes_review_fields_write_once, from
-- 0008) doesn't need to change - it already calls this function by name,
-- so replacing the function's body is all that's needed.
