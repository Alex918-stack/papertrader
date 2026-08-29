-- ============================================================================
-- Actually revoke EXECUTE. 0014 didn't work.
-- ============================================================================
--
-- 0014 revoked EXECUTE from `anon` and `authenticated` and changed nothing,
-- confirmed by catalog query: has_function_privilege stayed true for both
-- roles on every function. No error was raised - the statements were valid,
-- they just had no effect.
--
-- The reason: PostgreSQL grants EXECUTE to the PUBLIC pseudo-role by default
-- whenever a function is created. anon and authenticated inherit it from
-- there, so revoking their direct grants leaves the inherited one intact.
-- The privilege has to be revoked from PUBLIC itself, then granted back
-- explicitly to whoever legitimately needs it.
--
-- (Note the ambiguity in `revoke ... from public` - that's the PUBLIC
-- pseudo-role, not the public schema.)

-- Trigger function. Fired by on_auth_user_created; never meaningful as an
-- RPC endpoint. Nobody needs EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Event trigger function (returns event_trigger). Cannot be meaningfully
-- invoked outside an event-trigger context. Nobody needs EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- The app calls this as a signed-in user, so authenticated must keep it.
-- Revoke from PUBLIC first (which removes it for everyone), then grant back
-- to authenticated only.
revoke execute on function public.reset_portfolio() from public, anon, authenticated;
grant execute on function public.reset_portfolio() to authenticated;

-- ============================================================================
-- VERIFY, don't assume
-- ============================================================================
--
-- This is the second migration in this project recorded as applied without
-- having taken effect (0004 was the first). Always confirm against the
-- catalog rather than trusting the migration history:
--
--   select proname,
--          has_function_privilege('anon', oid, 'execute') as anon,
--          has_function_privilege('authenticated', oid, 'execute') as auth
--   from pg_proc
--   where proname in ('handle_new_user','rls_auto_enable',
--                     'reset_portfolio','execute_trade');
--
-- Expected: handle_new_user and rls_auto_enable false/false,
-- reset_portfolio false/true, execute_trade unchanged (true for
-- authenticated - the app needs it).
--
-- Then sign up with a brand-new Google account and confirm profiles and
-- portfolios rows are still created. handle_new_user provisions every new
-- user; a broken revoke here breaks signup silently.
