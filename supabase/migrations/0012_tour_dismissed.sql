-- ============================================================================
-- AI Paper Trader — Stage 8: guided tour dismissal state
-- ============================================================================
-- Applied via `npx supabase db push`. Verification query below.
--
-- Set the first time a signed-in user either finishes or explicitly skips
-- the guided tour - the client uses null vs. non-null to decide whether to
-- show the "New here? 3-minute tour" prompt on the dashboard. Not split
-- into separate "completed" and "skipped" columns: both are exactly the
-- same signal for this column's one purpose (stop auto-prompting), and the
-- tour doesn't need to distinguish them anywhere else.
--
-- No RLS or grant changes needed: profiles already has a full-row
-- "profiles_update_own" policy (0001) with no column-level restriction the
-- way position_episodes' review fields have (0008) - a new nullable column
-- here just falls under that existing policy automatically, same as any
-- other profiles column would.
--
-- Guests never reach this column at all - they have no profiles row (no
-- auth.users row to trigger one), so "has seen the tour" for a guest can
-- only ever live client-side (localStorage), same as the rest of their
-- in-memory-only experience.
alter table public.profiles
  add column tour_dismissed_at timestamptz;

comment on column public.profiles.tour_dismissed_at is
  'Set once, the first time this user finishes or skips the guided tour - null means the dashboard should still offer it. Not a completion flag distinct from a skip; both mean "stop prompting."';
