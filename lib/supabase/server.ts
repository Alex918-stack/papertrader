import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

// A server-side Supabase client, scoped to the current request's cookies.
// Deliberately NOT cached in a module-level variable - each call creates a
// fresh client bound to this request's cookie jar. Reusing one client across
// requests would leak one user's session into another's.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which can't set cookies on
            // the response. Fine as long as proxy.ts is also refreshing the
            // session (it is) - that's what actually persists the refresh.
          }
        },
      },
    }
  );
}

// Returns the signed-in user's email for this request, or null if signed
// out. Centralizes the "get claims, pull out email" pattern used by every
// API route that needs to know who's asking - getClaims() verifies the JWT
// locally (no round-trip to the Auth server in the common case) rather than
// trusting the cookie's contents outright.
export async function getAuthedEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" ? email : null;
}

// The signed-in user's id (the `sub` claim), verified from the JWT - never
// from anything the caller sent us.
//
// SECURITY: this is the ONLY acceptable source of a user id for any
// destructive or privileged operation. Do not add a parameter to this, and
// do not let a caller pass a user id in a request body, query string, or
// header "for convenience" - an admin-client delete keyed off client input
// is an endpoint that deletes arbitrary accounts on request.
export async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
