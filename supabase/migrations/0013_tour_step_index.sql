-- ============================================================================
-- AI Paper Trader — Stage 8.1: multi-page tour progress + reset interaction
-- ============================================================================
-- Applied via `npx supabase db push`. Verification query below.
--
-- tour_step_index is the tour's explicit sequencing state - which of the
-- ~16 ordered beats (lib/tour.ts's TOUR_BEATS) the user is on. Unlike
-- tour_dismissed_at (a one-way "stop prompting" flag), this needs to be
-- mutable and resumable: null means never started (or finished/skipped -
-- the client clears it back to null at both those points, same as it sets
-- tour_dismissed_at then). A number means a genuinely suspended,
-- resumable tour sits at that beat.
--
-- No RLS or grant changes needed, same reasoning as 0012: profiles already
-- has a full-row "profiles_update_own" policy (0001) with no column-level
-- restriction, so a new nullable column falls under it automatically.
alter table public.profiles
  add column tour_step_index integer;

comment on column public.profiles.tour_step_index is
  'Which beat (0-based index into lib/tour.ts TOUR_BEATS) a suspended tour is on. Null means never started, or finished/skipped - cleared back to null by the client at both those points. A number means resumable.';

-- ----------------------------------------------------------------------------
-- reset_portfolio: also clear a suspended tour's step index
-- ----------------------------------------------------------------------------
-- Bug this closes: forward-only reconciliation (lib/tour.ts) can correct
-- the index forward when real state shows more progress than persisted,
-- but it has no way to correct backward. If someone abandons the tour at
-- the journal beat, resets their portfolio (deleting that very episode via
-- 0011's reset_portfolio), then resumes, tour_step_index still says
-- "journal beat" and points at a row that no longer exists.
--
-- Scoped to `tour_dismissed_at is null` - "whenever the tour isn't
-- complete," per the exact condition asked for. A finished or skipped
-- tour already has tour_step_index cleared by the client at the moment it
-- finished, so this is a no-op for that case, not a special case to
-- reason about separately - it only ever does real work for a genuinely
-- suspended tour, which is exactly the scenario that can go stale.
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
  delete from position_episodes where portfolio_id = v_portfolio_id;

  update profiles
  set tour_step_index = null
  where id = auth.uid() and tour_dismissed_at is null;
end;
$$;
-- No grant re-issued - same-signature replace (0011 already established
-- this precedent for this exact function), so the existing grant to
-- `authenticated` survives on its own.
