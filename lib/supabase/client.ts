import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

// A browser-side Supabase client. Safe to call multiple times - it reads
// the session from the same localStorage-backed storage each time, so every
// call effectively shares one signed-in state within the browser tab.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
