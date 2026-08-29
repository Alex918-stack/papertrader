-- ============================================================================
-- AI Paper Trader — Stage 6: trade thesis + journal
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0007.

-- ----------------------------------------------------------------------------
-- position_episodes: a position's life from zero shares to zero shares
-- ----------------------------------------------------------------------------
-- An explicit table, not derived from transaction history: the thesis needs
-- a stable identity to attach to that exists at the moment a position
-- opens (so "required to open" can be enforced then, not discovered later
-- by scanning), and closed episodes need to survive untouched when the
-- same symbol is later reopened - a fresh row handles that by construction,
-- deriving boundaries from a running balance would not.
--
-- Thesis columns are NOT NULL, unlike transactions.quoted_price/spread_cost/
-- slippage_cost in 0007 - those are nullable because real historical rows
-- predate that feature. This table has no such history: every row that will
-- ever exist is created going forward, by an authenticated user, at the
-- moment a position opens, and a thesis is required at that moment. NOT
-- NULL encodes a real permanent invariant here, not a temporary one.
create table public.position_episodes (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  symbol text not null check (symbol = upper(symbol)),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,

  thesis_why_this text not null check (length(trim(thesis_why_this)) > 0),
  thesis_why_now text not null check (length(trim(thesis_why_now)) > 0),
  -- "What would prove me wrong" - the non-negotiable third field. Freeform,
  -- same as the other two.
  thesis_invalidation text not null check (length(trim(thesis_invalidation)) > 0),
  -- Optional structured companion to thesis_invalidation: many invalidations
  -- are naturally price-based ("if it drops below $150") even when stated
  -- as prose. Capturing that as a number when it's there means "did the
  -- exit match the stated invalidation" can be a direct comparison later
  -- instead of requiring language understanding every time the scorecard
  -- runs. Not every invalidation reduces to a number, so this stays
  -- optional rather than joining the three required fields above.
  thesis_invalidation_price numeric(14, 6) check (thesis_invalidation_price is null or thesis_invalidation_price >= 0),

  -- Set once, later, when the episode closes - see record_exit_reflection
  -- below. A small fixed tag rather than freeform text: the point is to
  -- make "did positions work for the stated reason" a query the future
  -- scorecard can run, not an LLM re-read of prose every time it runs.
  exit_reflection text check (exit_reflection in (
    'thesis_played_out', 'invalidated_as_expected', 'exited_early_emotional',
    'exited_early_new_info', 'other'
  )),
  exit_reflection_note text,

  -- Brex's critique of the closed episode, generated once by application
  -- code (an LLM call, which can't happen inside this table's constraints
  -- or triggers) and stored - not regenerated on every journal page view.
  -- "I said X and Brex told me Y" has to be a stable fact, not something
  -- that reads differently each time the page loads.
  critique text,
  critique_generated_at timestamptz
);

comment on table public.position_episodes is
  'A position''s life from opening (zero shares to nonzero) through closing (back to zero). Thesis is captured once at open and is immutable thereafter - see the missing UPDATE grant on the thesis columns below. Reopening the same symbol after a full close creates a new row; the old one is never touched.';

comment on column public.position_episodes.thesis_invalidation_price is
  'Optional numeric companion to thesis_invalidation - populated when the stated invalidation is naturally price-based, null otherwise. Lets a later scorecard compare the exit price against a real number instead of parsing prose.';

comment on column public.position_episodes.exit_reflection is
  'A small fixed self-assessment tag recorded once the episode closes, via record_exit_reflection - not freeform, so it stays a queryable signal for the future decision-quality scorecard rather than requiring re-analysis of prose.';

comment on column public.position_episodes.critique is
  'Brex''s critique of the closed episode, generated once by application code and stored here - never regenerated on view. See the write-once trigger below for what enforces that.';

-- Enforces "at most one open episode per symbol per portfolio" - the same
-- (portfolio_id, symbol) shape as holdings' own unique constraint, but
-- partial (only over open rows) because unlike holdings, closed episodes
-- must stay around as history rather than being deleted. This index is
-- also the mechanism execute_trade relies on below to find "the" open
-- episode for an add-on, partial exit, or close without ambiguity.
create unique index position_episodes_open_unique
  on public.position_episodes (portfolio_id, symbol)
  where closed_at is null;

-- For "give me every episode for this portfolio" (the journal page's
-- primary query) - not redundant with the partial index above, which can
-- only ever serve queries provably restricted to open rows.
create index position_episodes_portfolio_id_idx
  on public.position_episodes (portfolio_id);

-- ----------------------------------------------------------------------------
-- transactions: associate each trade with the episode it belongs to
-- ----------------------------------------------------------------------------
-- Nullable, no backfill - same precedent as 0007's execution-cost columns.
-- Historical trades predate the episode concept and stay null forever.
-- Trades on a position that was already open before this migration (so
-- there's no episode row to attach to) also get null here going forward -
-- see execute_trade below. Neither case is an error; both just fall
-- outside episode tracking, honestly.
alter table public.transactions
  add column episode_id uuid references public.position_episodes (id),
  add column note text;

comment on column public.transactions.episode_id is
  'Which position episode this trade belongs to. Null for trades before this feature shipped, and for trades against a position that was already open before this feature shipped (no episode exists to attach to) - not backfilled either way.';

comment on column public.transactions.note is
  'Optional freeform commentary - "why adding more" on an add-on buy, "why trimming now" on a partial exit. Never required: only the opening trade of a new episode requires anything (the thesis, on position_episodes, enforced by execute_trade).';

create index transactions_episode_id_idx on public.transactions (episode_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.position_episodes enable row level security;

create policy "position_episodes_select_own" on public.position_episodes
  for select
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = position_episodes.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

create policy "position_episodes_insert_own" on public.position_episodes
  for insert
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = position_episodes.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

-- Row-level scoping only gets you "which rows" - it cannot express "which
-- columns," which is exactly the problem with an UPDATE policy here: any
-- policy permissive enough to let execute_trade set closed_at is exactly
-- permissive enough to let a direct PostgREST PATCH rewrite the thesis
-- columns on the same row. The actual column boundary is enforced below,
-- by grant, not by this policy - this policy only needs to say "your own
-- rows," the same shape as every other owned-row policy in this schema.
create policy "position_episodes_update_own" on public.position_episodes
  for update
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = position_episodes.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = position_episodes.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

-- No delete policy - permanent history, same append-only-in-spirit stance
-- as transactions.

-- ----------------------------------------------------------------------------
-- Column-level privileges: the thesis columns are write-once by omission
-- ----------------------------------------------------------------------------
-- Supabase grants broad table-level privileges to `authenticated` by
-- default the moment a table is created - none of 0001-0007 contains a
-- single explicit table-level grant, and holdings/portfolios/transactions
-- all already work for authenticated users under RLS alone. That default
-- grant, if left in place, would make the narrower grant below meaningless:
-- privileges are additive in Postgres, so a specific column grant can never
-- take back what a broader table-level grant already gave. The revoke is
-- what actually does the restricting; the grant that follows only adds
-- back the five columns that legitimately need to be updatable after a row
-- is created. Every other column - the four thesis columns plus symbol,
-- portfolio_id, opened_at - has no UPDATE path at all, for any role,
-- anywhere: not through this policy, not through PostgREST, not through
-- anything short of a migration. That's what makes "the thesis is
-- immutable" true by construction instead of by convention.
revoke update on public.position_episodes from authenticated;

grant update (closed_at, exit_reflection, exit_reflection_note, critique, critique_generated_at)
  on public.position_episodes to authenticated;

-- SELECT and INSERT are left on Supabase's default grant (matching every
-- other table in this schema, which relies on the same default rather than
-- an explicit statement) - RLS row-scoping is sufficient for both, and
-- there's no column-boundary concern on insert the way there is on update:
-- a fresh row's thesis fields are being written by their own author for
-- the first time, not rewritten after the fact.
--
-- Explicit anyway, unlike the rest of this schema: this migration's whole
-- point is precise privilege control, so it shouldn't leave SELECT/INSERT
-- as an unstated assumption about project-level defaults, even though
-- they're already correct.
grant select on public.position_episodes to authenticated;
grant insert on public.position_episodes to authenticated;

-- ----------------------------------------------------------------------------
-- Write-once enforcement for the review-time fields
-- ----------------------------------------------------------------------------
-- The column grant above says who may attempt to update closed_at,
-- exit_reflection, exit_reflection_note, critique, and critique_generated_at
-- - it says nothing about how many times. Without this, a user could PATCH
-- exit_reflection repeatedly via PostgREST, quietly revising their
-- self-assessment after the fact - the exact rationalization risk the
-- thesis-immutability design exists to prevent, just one column over.
-- record_exit_reflection below already refuses to run twice, but that's
-- the front door; this is the same "two independent layers agreeing, not
-- one pretending to stand in for the other" reasoning execute_trade's own
-- comments already use for RLS-plus-auth.uid() scoping, applied here to
-- function-plus-trigger instead.
--
-- Each field may move from null to a value exactly once. Setting closed_at
-- for the first time is the interesting case, not just "once" but "only
-- when true": a direct PATCH could otherwise mark an episode closed while
-- the position is still open, which is worse than cosmetic - the next buy
-- of that symbol would be treated as an add-on (no thesis required,
-- because holdings already has a row), and the real eventual sell would
-- find no open episode left to close. So the null -> value transition is
-- only allowed when no holdings row exists for that (portfolio_id,
-- symbol). execute_trade's sell branch deletes the holdings row and only
-- afterward - a separate, later statement in the same function body, not
-- combined into one where evaluation order could be ambiguous - updates
-- closed_at, so a legitimate close always sees zero holdings rows here and
-- always passes. A direct PATCH attempting to fabricate a close while
-- shares are still held will always find a holdings row and can never
-- pass, regardless of how it's attempted. Changing closed_at again after
-- it's set, including back to null, is never allowed either way.
create or replace function public.prevent_position_episode_review_overwrite()
returns trigger
language plpgsql
as $$
begin
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

create trigger position_episodes_review_fields_write_once
  before update on public.position_episodes
  for each row execute function public.prevent_position_episode_review_overwrite();

-- ----------------------------------------------------------------------------
-- execute_trade: require a thesis to open, attach every trade to its
-- episode, close the episode atomically with the sell that zeroes it
-- ----------------------------------------------------------------------------
-- Not a create or replace of the 0007 version, for the same reason 0007
-- wasn't a replace of 0002's: adding parameters changes the signature, and
-- create or replace only replaces when the signature matches exactly.
-- Dropping the old signature first, then re-granting after, avoids both
-- the overload ("function execute_trade is not unique") and the silently
-- dropped grant that a bare create or replace would risk here.
drop function if exists public.execute_trade(
  text, text, numeric, numeric, numeric, numeric, numeric
);

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

    -- v_existing_shares is null here means exactly "opening a new
    -- position" - checked before any writes, so a missing thesis fails
    -- loudly before anything else happens, not after.
    if v_existing_shares is null then
      if p_thesis_why_this is null or trim(p_thesis_why_this) = ''
         or p_thesis_why_now is null or trim(p_thesis_why_now) = ''
         or p_thesis_invalidation is null or trim(p_thesis_invalidation) = '' then
        raise exception 'A thesis (why this, why now, invalidation) is required to open a new position';
      end if;
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
      -- Adding to an existing position - optional p_note only, no thesis.
      -- Null if this position predates episode tracking (opened before
      -- this migration) - see the comment on transactions.episode_id.
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

    -- Atomic close: the same transaction as the sell that zeroes the
    -- position, not a separate call. This has to happen here - a window
    -- where the position is fully sold but closed_at is still null would
    -- mean an immediate re-buy of the same symbol hits
    -- position_episodes_open_unique, because as far as the database is
    -- concerned an open episode for this symbol would still exist.
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

grant execute on function public.execute_trade(
  text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, numeric, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- record_exit_reflection: the one, separate, later action
-- ----------------------------------------------------------------------------
-- Unlike closing (which must be atomic with the sell - see above), the
-- reflection is genuinely a separate action that happens after the fact,
-- possibly much later. security invoker, same as execute_trade: it only
-- needs what RLS and the column grant above already permit the calling
-- user to do to their own row: no RLS bypass required, so no definer
-- privileges either.
create or replace function public.record_exit_reflection(
  p_episode_id uuid,
  p_exit_reflection text,
  p_exit_reflection_note text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_owner uuid;
  v_closed_at timestamptz;
  v_existing_reflection text;
begin
  select portfolios.user_id, position_episodes.closed_at, position_episodes.exit_reflection
    into v_owner, v_closed_at, v_existing_reflection
  from position_episodes
  join portfolios on portfolios.id = position_episodes.portfolio_id
  where position_episodes.id = p_episode_id;

  if v_owner is null then
    raise exception 'Episode not found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Not your episode';
  end if;
  if v_closed_at is null then
    raise exception 'Episode is not closed yet';
  end if;
  if v_existing_reflection is not null then
    raise exception 'Exit reflection already recorded';
  end if;

  update position_episodes
  set exit_reflection = p_exit_reflection,
      exit_reflection_note = p_exit_reflection_note
  where id = p_episode_id;
end;
$$;

grant execute on function public.record_exit_reflection to authenticated;
