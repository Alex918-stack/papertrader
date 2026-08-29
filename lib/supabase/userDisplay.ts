import type { User } from "@supabase/supabase-js";

// Google's OAuth payload isn't consistent about key names across flows -
// same reasoning as the full_name/name and avatar_url/picture coalesce in
// the handle_new_user SQL trigger from stage 1. This is the client-side
// equivalent, reading from the signed-in user's metadata instead of a
// database row.

export function getDisplayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  return meta.full_name || meta.name || user.email || "";
}

export function getAvatarUrl(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return meta.avatar_url || meta.picture || null;
}
