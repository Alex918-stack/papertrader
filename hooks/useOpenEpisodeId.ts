"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";

// The id of the currently-open position_episodes row for a symbol, or null
// if there isn't one (no holding, or signed out - guests have no episodes
// at all). Used to link an add-on/sell's "already journaled" context line
// straight to that episode, instead of just naming the fact that one exists.
export function useOpenEpisodeId(symbol: string): string | null {
  const { status } = useAuth();
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !symbol) return;
    let cancelled = false;

    async function load() {
      setEpisodeId(null); // clear any previous symbol's id while this one loads
      const supabase = createClient();
      const { data } = await supabase
        .from("position_episodes")
        .select("id")
        .eq("symbol", symbol)
        .is("closed_at", null)
        .maybeSingle();
      if (!cancelled) setEpisodeId(data?.id ?? null);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [status, symbol]);

  return status === "authenticated" ? episodeId : null;
}
