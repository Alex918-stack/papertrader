-- ============================================================================
-- Revoke EXECUTE on functions that have no business being reachable through
-- the REST API. Raised by Supabase's database linter (0028/0029).
-- ============================================================================
--
-- None of these are known-exploitable today. This is closing surface area
-- that was never meant to be open, not patching a live hole.

-- handle_new_user() is a TRIGGER function, fired by on_auth_user_created
-- when Supabase Auth inserts into auth.users. It has no meaning as an RPC
-- endpoint - called directly it would fail, since `new` is null outside a
-- trigger context.
--
-- Safe to revoke: PostgreSQL checks EXECUTE privilege when the trigger is
-- CREATED, not each time it fires, and the insert that fires it runs as
-- supabase_auth_admin rather than anon/authenticated.
--
-- VERIFY AFTER APPLYING: sign up with a brand-new Google account and
-- confirm profiles + portfolios rows are still created. This function is
-- what provisions every new user; if this revoke somehow broke it, signup
-- breaks silently and you'd find out in front of an audience.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- rls_auto_enable() is an EVENT trigger function (returns event_trigger)
-- that auto-enables RLS on any new table created in public. It's a safety
-- net, already hardened with SET search_path TO 'pg_catalog', and cannot
-- meaningfully be invoked over RPC - pg_event_trigger_ddl_commands() errors
-- outside an event-trigger context. Revoked for tidiness, not because it's
-- exploitable.
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- reset_portfolio() stays callable by authenticated (the app needs it) but
-- has no business being invokable by signed-out callers. It's SECURITY
-- DEFINER, so it bypasses RLS by role privilege; today an anon call is a
-- no-op because its own `where user_id = auth.uid()` matches nothing, but
-- that's a property of the function body rather than a permission boundary.
-- Make it a permission boundary.
revoke execute on function public.reset_portfolio() from anon;

-- ============================================================================
-- Deliberately NOT addressed here
-- ============================================================================
--
-- rls_enabled_no_policy on rate_limit_cooldowns and symbol_daily_prices_claims
-- is intentional. RLS is enabled with zero policies precisely so no client
-- role can read or write them - they hold rate-limit state and cache leases,
-- not product data. Do not "fix" this lint by adding a policy.
--
-- function_search_path_mutable on the remaining eight functions is real but
-- deferred: most are SECURITY INVOKER (low risk), and pinning search_path
-- carelessly can break a function that resolves an unqualified name from the
-- extensions schema. Fix with `public, extensions` and re-test a trade and a
-- reset. Tracked in POST_DEMO.md.
--
-- auth_leaked_password_protection is not applicable. This project uses Google
-- OAuth exclusively; there are no passwords to check against HaveIBeenPwned.
