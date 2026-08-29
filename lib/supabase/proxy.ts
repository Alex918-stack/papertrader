import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request that passes
// through it. Deliberately does NOT redirect or block anything - see
// proxy.ts at the project root for why that matters here.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove this call or add code between createServerClient() and it.
  // getClaims() is what actually triggers a token refresh when the access
  // token is close to expiring, and the refreshed cookie is what setAll()
  // above writes onto supabaseResponse. Skip this and sessions silently stop
  // refreshing - see the "what breaks without this" note in the stage
  // explanation for the full failure mode.
  await supabase.auth.getClaims();

  // IMPORTANT: supabaseResponse must be returned as-is (or copied onto a new
  // response with request + cookies preserved). Building a fresh response
  // here without carrying over these cookies would silently drop the
  // refreshed session.
  return supabaseResponse;
}
