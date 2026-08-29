import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Where Google sends the user back to after they approve (or deny) the
// consent screen. The URL carries a one-time `code` that this route trades
// for a real session - the actual sign-in doesn't happen in the browser at
// all, it happens here, server-side.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    // This is the one call that actually establishes the session: it sends
    // the code to Supabase, gets back an access/refresh token pair, and
    // (via the server client's setAll from lib/supabase/server.ts) writes
    // them as cookies on the redirect response below.
    await supabase.auth.exchangeCodeForSession(code);
  }

  // No dedicated error page in this stage - if the code is missing or the
  // exchange fails, the user just lands back where they started, still
  // signed out. Nothing in the app is gated on auth, so that's a safe
  // failure mode, not a broken one. Worth revisiting if you want a visible
  // "sign-in failed" message later.
  return NextResponse.redirect(new URL(next, request.nextUrl.origin));
}
