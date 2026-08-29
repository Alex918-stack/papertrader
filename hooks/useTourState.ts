"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useJournal } from "@/components/journal/JournalProvider";
import { useTourProgress } from "@/hooks/useTourProgress";
import { createClient } from "@/lib/supabase/client";
import { TOUR_SYMBOL, TOUR_BEATS, deriveTourPhase, reconcileStepIndex, TourPhase } from "@/lib/tour";

// Krix's critique is fire-and-forget from PortfolioContext.trade() (see its
// comment on why) - useJournal fetches once on mount, it doesn't poll. The
// tour needs to know the moment this specific episode's critique lands, so
// it polls that one row narrowly rather than adding general polling to the
// whole journal page for everyone. Stops the instant it finds a value.
const CRITIQUE_POLL_MS = 3000;

export interface TourState {
  phase: TourPhase;
  closedEpisodeId: string | null;
  // True whenever the tour symbol has any leftover activity - a prior
  // transaction, an open holding, or a closed episode - independent of
  // dismissed/active status. deriveTourPhase's "dismissed" check masks
  // these signals inside `phase` itself, so replay needs this exposed
  // separately to know whether starting now would actually land on
  // need_buy or jump straight into the middle of old activity.
  hasExistingActivity: boolean;
  // Session-local "cleared to actively drive right now" flag - never
  // persisted. A truthy persisted stepIndex from a previous session does
  // NOT imply this; needsResumeConfirmation exists precisely because
  // resuming should be an explicit click, not a silent auto-continue the
  // instant any page loads.
  active: boolean;
  // Suspends driving without dismissing - unlike skip()/finish(), leaves
  // tour_dismissed_at/tour_step_index untouched, so needsResumeConfirmation
  // becomes true immediately and the existing resume prompt re-offers
  // wherever the user ends up. Used when GuidedTour detects pathname has
  // drifted away from the active beat's page for longer than a real
  // navigation should ever take - the tour paused itself rather than
  // either forcing the user back or leaving a stale popover on screen.
  pause: () => void;
  // The current beat's reconciled position - lib/tour.ts's
  // reconcileStepIndex pushes this ahead of whatever's persisted whenever
  // real trade-lifecycle state (phase) implies more progress than the
  // stored index does. Meaningless while !active; 0 in that case.
  stepIndex: number;
  totalBeats: number;
  // A suspended, resumable tour exists (persisted stepIndex set,
  // dismissedAt null) but this session hasn't confirmed continuing it yet.
  needsResumeConfirmation: boolean;
  resumeStepIndex: number | null;
  start: () => void;
  resume: () => void;
  advanceTo: (index: number) => void;
  skip: () => void;
  finish: () => void;
}

// The single source of truth the tour orchestrator (components/tour/GuidedTour.tsx),
// the resume/start prompt, and Settings all read from. Two layers, not one:
// deriveTourPhase (unchanged) still owns whether a real trade-lifecycle
// event happened; stepIndex owns sequencing through beats that have no
// independent state to check (a navigation/informational beat has nothing
// in the database that says "seen"). reconcileStepIndex is where they
// meet - forward-only, so going off-script during a doing beat still
// self-corrects the way it always did, and it's also literally how doing
// beats advance at all, not a separate mechanism bolted on for the
// off-script case.
export function useTourState(): TourState {
  const { status: authStatus } = useAuth();
  const { transactions, holdings } = usePortfolio();
  const journal = useJournal();
  const progress = useTourProgress();
  const { setStepIndex, dismiss } = progress;
  const [active, setActive] = useState(false);

  const hasTourSymbolTransaction = transactions.some((t) => t.symbol === TOUR_SYMBOL);
  const holdsTourSymbol = holdings.some((h) => h.symbol === TOUR_SYMBOL);

  const closedTourSymbolEpisode =
    journal.status === "ok"
      ? journal.episodes
          .filter((e) => e.symbol === TOUR_SYMBOL && e.closedAt !== null)
          .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())[0] ?? null
      : null;

  const phase = deriveTourPhase({
    authStatus,
    tourDismissedAt: progress.dismissedAt,
    active,
    hasTourSymbolTransaction,
    holdsTourSymbol,
    closedTourSymbolEpisode: closedTourSymbolEpisode
      ? { id: closedTourSymbolEpisode.id, critique: closedTourSymbolEpisode.critique }
      : null,
  });

  const pollEpisodeId = phase === "closed_awaiting_critique" ? closedTourSymbolEpisode?.id ?? null : null;
  useEffect(() => {
    if (!pollEpisodeId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("position_episodes")
        .select("critique, critique_generated_at")
        .eq("id", pollEpisodeId)
        .maybeSingle();
      if (cancelled || !data?.critique) return;
      if (journal.status === "ok") {
        journal.updateEpisode(pollEpisodeId, {
          critique: data.critique,
          critiqueGeneratedAt: data.critique_generated_at,
        });
      }
    }, CRITIQUE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollEpisodeId]);

  const persistedStepIndex = progress.stepIndex ?? 0;
  const reconciledStepIndex = active ? reconcileStepIndex(persistedStepIndex, phase) : 0;

  // Persist a forward correction the instant reality implies one - this is
  // what lets a doing beat advance from real state changing, not just from
  // a button click, and what makes the correction durable across a reload
  // mid-correction.
  useEffect(() => {
    if (!active) return;
    if (reconciledStepIndex > persistedStepIndex) {
      setStepIndex(reconciledStepIndex);
    }
  }, [active, reconciledStepIndex, persistedStepIndex, setStepIndex]);

  const needsResumeConfirmation =
    authStatus === "authenticated" && progress.dismissedAt === null && progress.stepIndex !== null && !active;

  const start = useCallback(() => {
    setActive(true);
    setStepIndex(0);
  }, [setStepIndex]);
  const resume = useCallback(() => setActive(true), []);
  const pause = useCallback(() => setActive(false), []);
  const advanceTo = useCallback((index: number) => setStepIndex(index), [setStepIndex]);
  const skip = useCallback(() => {
    setActive(false);
    dismiss();
  }, [dismiss]);
  const finish = useCallback(() => {
    setActive(false);
    dismiss();
  }, [dismiss]);

  return {
    phase,
    closedEpisodeId: closedTourSymbolEpisode?.id ?? null,
    hasExistingActivity: hasTourSymbolTransaction || holdsTourSymbol || closedTourSymbolEpisode !== null,
    active,
    pause,
    stepIndex: reconciledStepIndex,
    totalBeats: TOUR_BEATS.length,
    needsResumeConfirmation,
    resumeStepIndex: progress.stepIndex ?? null,
    start,
    resume,
    advanceTo,
    skip,
    finish,
  };
}
