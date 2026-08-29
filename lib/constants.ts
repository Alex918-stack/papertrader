// Mirrors the portfolios.cash column default (public.default_starting_cash()
// in supabase/migrations/0002_portfolio_functions.sql) - that migration is
// the real source of truth for signed-in users. This constant covers the
// fallback used before the first load resolves, signed-out (in-memory-only)
// sessions, which never touch the database at all, and the benchmark route
// (app/api/benchmark/route.ts), which needs the same starting figure
// server-side without importing a "use client" module for it.
export const STARTING_CASH = 100000;
