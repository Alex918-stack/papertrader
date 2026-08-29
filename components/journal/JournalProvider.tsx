"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export interface JournalEpisode {
  id: string;
  symbol: string;
  openedAt: string;
  closedAt: string | null;
  thesisWhyThis: string | null;
  thesisWhyNow: string | null;
  thesisInvalidation: string | null;
  thesisInvalidationPrice: number | null;
  exitReflection: string | null;
  exitReflectionNote: string | null;
  critique: string | null;
  critiqueGeneratedAt: string | null;
}

type JournalStatus =
  | { status: "loading" }
  | { status: "signed_out" }
  | {
      status: "ok";
      episodes: JournalEpisode[];
      thesisCount: number;
      totalCount: number;
      updateEpisode: (id: string, patch: Partial<JournalEpisode>) => void;
    };

// refetch sits outside the status union, not inside the "ok" branch - it
// has to be callable unconditionally from lib/PortfolioContext.tsx without
// that caller needing to know or care what journal's current display
// status is.
export type JournalResult = JournalStatus & { refetch: () => Promise<void> };

const JournalContext = createContext<JournalResult | null>(null);

// Fixes the same class of bug TourProvider fixed for tour state: episodes
// lived in a plain useState with no channel for "the underlying rows
// changed" to reach it. resetPortfolio() deletes every episode server-side
// (0011) and a trade opens or closes one, but neither ever touched this
// state before - the client kept showing rows that no longer existed
// (bug 2) or never showed ones that newly did (bug 1). refetch() is called
// from the exact moments lib/PortfolioContext.tsx knows the data changed,
// instead of polling for a change that might not be coming.
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [episodes, setEpisodes] = useState<JournalEpisode[] | null>(null);
  // Guards against a slower, superseded request overwriting a newer one's
  // result - not against a merely-unmounted effect, since refetch() is
  // called long after mount, on demand.
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    const supabase = createClient();
    const { data } = await supabase
      .from("position_episodes")
      .select("*")
      .order("opened_at", { ascending: false });
    if (requestId !== requestIdRef.current) return;
    setEpisodes(
      (data ?? []).map(
        (row): JournalEpisode => ({
          id: row.id,
          symbol: row.symbol,
          openedAt: row.opened_at,
          closedAt: row.closed_at,
          thesisWhyThis: row.thesis_why_this,
          thesisWhyNow: row.thesis_why_now,
          thesisInvalidation: row.thesis_invalidation,
          thesisInvalidationPrice: row.thesis_invalidation_price,
          exitReflection: row.exit_reflection,
          exitReflectionNote: row.exit_reflection_note,
          critique: row.critique,
          critiqueGeneratedAt: row.critique_generated_at,
        })
      )
    );
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    refetch();
  }, [authStatus, refetch]);

  const updateEpisode = useCallback((id: string, patch: Partial<JournalEpisode>) => {
    setEpisodes((prev) => (prev ? prev.map((e) => (e.id === id ? { ...e, ...patch } : e)) : prev));
  }, []);

  let statusValue: JournalStatus;
  if (authStatus === "loading") {
    statusValue = { status: "loading" };
  } else if (authStatus !== "authenticated") {
    statusValue = { status: "signed_out" };
  } else if (episodes === null) {
    statusValue = { status: "loading" };
  } else {
    statusValue = {
      status: "ok",
      episodes,
      // "Has a thesis" is thesis_why_this alone, not all three fields - the
      // form is submitted as one unit, so in practice they're filled
      // together or not at all, and using one representative field avoids
      // a three-state count for a stat whose whole point is being simple
      // to read at a glance ("N of M").
      thesisCount: episodes.filter((e) => e.thesisWhyThis !== null).length,
      totalCount: episodes.length,
      updateEpisode,
    };
  }

  return <JournalContext.Provider value={{ ...statusValue, refetch }}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalResult {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within a JournalProvider");
  return ctx;
}
