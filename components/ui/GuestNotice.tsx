"use client";

import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Shown wherever a signed-out user is about to do something that won't
// persist - contextual, not a page-wide banner, so it stays easy to ignore
// once you already know what it says.
export default function GuestNotice() {
  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
      },
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-sand-100 px-3 py-2 text-sm text-sand-700">
      <Info size={15} className="flex-shrink-0" />
      <span>
        Sign in to save your portfolio.{" "}
        <button
          onClick={handleSignIn}
          className="font-medium underline underline-offset-2 hover:text-sand-800"
        >
          Sign in with Google
        </button>
      </span>
    </div>
  );
}
