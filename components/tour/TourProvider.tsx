"use client";

import { createContext, useContext } from "react";
import { useTourState, TourState } from "@/hooks/useTourState";

// Fixes a real bug: useTourState() was being called independently in three
// places (GuidedTour, TourPrompt, Settings), each getting its own private
// `active` useState. Settings' "Replay Tour" flipped active=true in its own
// copy - GuidedTour, the thing that actually drives driver.js, never saw
// it, stayed on whatever phase its own stale local state produced, and
// every one of its effects' phase guards silently returned. One Context
// instance, computed once, is what makes "start the tour from Settings"
// and "GuidedTour reacts to it" the same fact instead of two hopeful copies
// of it.
const TourContext = createContext<TourState | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const tour = useTourState();
  return <TourContext.Provider value={tour}>{children}</TourContext.Provider>;
}

export function useTour(): TourState {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
