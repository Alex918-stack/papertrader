import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Permanently delete the signed-in user's account.
 *
 * SECURITY — read before changing anything here:
 *
 * This route uses the service-role client, which bypasses every RLS policy
 * in the database by Postgres role privilege. The ONLY thing preventing it
 * from deleting arbitrary accounts is that the user id comes from
 * getAuthedUserId() - the verified `sub` claim on the session JWT.
 *
 * Never accept a user id from the request body, query string, or a header.
 * Never add a parameter to this route. If a future change seems to need
 * one, it doesn't - it needs a different route.
 *
 * Everything else cascades: deleting the auth.users row removes profiles,
 * portfolios, holdings, transactions, position_episodes, conversations and
 * messages via ON DELETE CASCADE. rate_limit_cooldowns is keyed by
 * email/IP rather than user_id, so it doesn't cascade - those rows expire
 * on their own and hold no personal trading data.
 */
export async function POST() {
  const userId = await getAuthedUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in to delete your account." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Account deletion failed:", error.message);
    return NextResponse.json(
      { error: "We couldn't delete your account. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
