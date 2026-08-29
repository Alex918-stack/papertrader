import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Signed-in users key by email, same as before. Guests used to all share
// the literal string "anonymous" (app/api/chat/route.ts's old cooldown) -
// meaning one guest's request reset the cooldown clock for every other
// guest at once. Keying by request IP instead means guests only ever
// compete with themselves. x-forwarded-for's first entry is the original
// client - the only header Vercel's edge network actually sets reliably
// for this; there is no NextRequest.ip anymore in current Next.js.
export function getCooldownKey(request: NextRequest, email: string | null): string {
  if (email) return email;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "ip:unknown";
}

// Same atomic-claim shape as lib/marketDataCache.ts, applied to a
// completely different problem: "has this key made a request in the last
// N seconds," not "is this data fresh." One shared table
// (rate_limit_cooldowns), bucket distinguishing call sites, so adding a
// third rate-limited endpoint later doesn't mean designing this again.
//
// Replaces two in-memory Maps (app/api/chat/route.ts's lastRequestTime,
// and journal/critique/route.ts's total absence of one) that had the same
// problem as the old market-data caches: reset on every deploy, don't
// share across serverless instances - 30 people hitting different Vercel
// instances would each get their own independent cooldown clock.
//
// A plain conditional UPDATE is enough here, no insert-fallback needed
// like the market-data claim: the row for a given (bucket, key) either
// already exists (checked via the WHERE-guarded UPDATE) or doesn't, and
// "doesn't exist yet" should always be allowed through - there's no
// "pending" concept for a cooldown, just "have we seen this key recently."
export async function checkCooldown(bucket: string, key: string, cooldownMs: number): Promise<boolean> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - cooldownMs).toISOString();

  const { data: updated } = await admin
    .from("rate_limit_cooldowns")
    .update({ requested_at: nowIso })
    .eq("bucket", bucket)
    .eq("key", key)
    .lt("requested_at", cutoffIso)
    .select("key");

  if (updated && updated.length > 0) return true;

  // No existing row was old enough to update - either a real cooldown is
  // active (an UPDATE ran but its WHERE didn't match a too-recent row) or
  // this key has never been seen. INSERT ... ON CONFLICT DO NOTHING
  // resolves the same ambiguity the market-data claim resolves: it only
  // succeeds if the row genuinely didn't exist yet.
  const { data: inserted } = await admin
    .from("rate_limit_cooldowns")
    .upsert({ bucket, key, requested_at: nowIso }, { onConflict: "bucket,key", ignoreDuplicates: true })
    .select("key");

  return Boolean(inserted && inserted.length > 0);
}
