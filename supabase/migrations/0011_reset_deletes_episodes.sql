-- ============================================================================
-- AI Paper Trader — Stage 7.1: reset_portfolio also clears position_episodes
-- ============================================================================
-- Applied via `npx supabase db push`, not pasted into the SQL Editor - see
-- the verification query alongside this migration for how to confirm it
-- landed correctly.
--
-- Bug: reset_portfolio (0002, redefined in 0006) deletes holdings and
-- transactions but never touched position_episodes (introduced later, in
-- 0008). A reset left every episode behind with no transactions to compute
-- against - the scorecard (lib/decisionScorecard.ts) reads P&L from
-- transactions.total per episode, so an orphaned episode silently priced
-- as $0 in every metric, and useJournal's thesisCount/totalCount kept
-- counting episodes from a "cleared" portfolio. Wrong numbers in the one
-- feature that's entirely about honest arithmetic.
--
-- Verified before writing this, not assumed: the write-once trigger on
-- position_episodes (position_episodes_review_fields_write_once, 0008) is
-- declared `before update` only - `create trigger ... before update on
-- public.position_episodes ...` - so it has no BEFORE DELETE form and
-- cannot fire on, or block, a DELETE. It guards against a column being
-- rewritten after being set once; it has nothing to say about a row being
-- removed entirely.
--
-- No RLS or grant change needed: position_episodes has no delete policy
-- for `authenticated` at all (0008's own comment: "permanent history, same
-- append-only-in-spirit stance as transactions" - transactions has no
-- delete policy either). reset_portfolio is already `security definer`,
-- which is exactly how it already deletes from transactions today despite
-- that same absence of a delete policy - adding a delete against
-- position_episodes runs under the same elevated privileges, no new grant
-- required.
--
-- Ordering matters and is not arbitrary: transactions.episode_id
-- references position_episodes(id) with no ON DELETE clause (0008), which
-- defaults to NO ACTION - deleting a position_episodes row while a
-- transaction still points at it would raise a foreign key violation.
-- transactions must be, and already is, deleted first in this function;
-- position_episodes is deleted after, once nothing references it.
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
  -- Must come after the transactions delete above - see the FK ordering
  -- note at the top of this migration.
  delete from position_episodes where portfolio_id = v_portfolio_id;
end;
$$;
-- No grant re-issued - this is a genuine same-signature replace (zero
-- arguments, returns void, unchanged from 0006), so the existing grant to
-- `authenticated` survives on its own, same precedent already established
-- by 0009's execute_trade replace.
