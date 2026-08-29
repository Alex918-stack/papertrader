"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";

// Replaces useTourDismissed - now manages both profiles.tour_dismissed_at
// and profiles.tour_step_index together (one row, one fetch, rather than
// two hooks independently querying the same table). dismissedAt keeps its
// exact old meaning (one-way "stop prompting" flag). stepIndex is new:
// null means never started, or finished/skipped - dismiss() clears it back
// to null at exactly the same moment it sets dismissedAt, so "resumable"
// and "not dismissed" are kept the same fact instead of two flags that
// could disagree. A number means a genuinely suspended, resumable tour
// sits at that beat (lib/tour.ts's TOUR_BEATS).
export function useTourProgress() {
  const { status, user } = useAuth();
  const [dismissedAt, setDismissedAt] = useState<string | null | undefined>(undefined);
  const [stepIndex, setStepIndexState] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("tour_dismissed_at, tour_step_index")
        .maybeSingle();
      if (cancelled) return;
      setDismissedAt(data?.tour_dismissed_at ?? null);
      setStepIndexState(data?.tour_step_index ?? null);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const setStepIndex = useCallback(
    async (index: number) => {
      if (!user) return;
      setStepIndexState(index); // optimistic - low-stakes sequencing state, not trade data
      const supabase = createClient();
      await supabase.from("profiles").update({ tour_step_index: index }).eq("id", user.id);
    },
    [user]
  );

  const dismiss = useCallback(async () => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    setDismissedAt(nowIso);
    setStepIndexState(null);
    const supabase = createClient();
    await supabase.from("profiles").update({ tour_dismissed_at: nowIso, tour_step_index: null }).eq("id", user.id);
  }, [user]);

  // Guests never reach the effect's fetch at all - resolved at read time
  // instead of via an effect-driven setState, same "derive it, don't set
  // it" fix as hooks/useStockQuotes.ts uses for its own empty case.
  const resolvedDismissedAt = status === "authenticated" ? dismissedAt : status === "loading" ? undefined : null;
  const resolvedStepIndex = status === "authenticated" ? stepIndex : status === "loading" ? undefined : null;

  return { dismissedAt: resolvedDismissedAt, stepIndex: resolvedStepIndex, setStepIndex, dismiss };
}
