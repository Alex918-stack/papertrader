import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Service-role client - bypasses RLS by Postgres role privilege, not by a
// policy. Used exactly where benchmark_prices' RLS (see the RLS section of
// supabase/migrations/0006_benchmark_baseline.sql) requires it: populating
// a shared table no client role can write to.
//
// Server-only. SUPABASE_SERVICE_ROLE_KEY must never reach the client
// bundle - never import this file from a "use client" component, only from
// route handlers and server-only modules like lib/benchmarkPrices.ts.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
