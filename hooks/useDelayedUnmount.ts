"use client";

import { useEffect, useState } from "react";

// Keeps a conditionally-rendered element mounted for `exitDuration` ms after
// `isOpen` flips false, so a CSS exit animation (keyed off the returned
// `state` via a `data-state` attribute) has time to play instead of the
// element vanishing on the same frame. The open/closing state flip happens
// during render (same tracked-key pattern as OrderTicket's resetKey) since
// it's just reacting to a prop change - only the actual delayed unmount is
// genuinely time-based, so that's the one piece owned by an effect, and the
// effect only ever calls setState from its timeout callback.
export function useDelayedUnmount(isOpen: boolean, exitDuration = 150) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [state, setState] = useState<"open" | "closing">(isOpen ? "open" : "closing");
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setShouldRender(true);
      setState("open");
    } else {
      setState("closing");
    }
  }

  useEffect(() => {
    if (isOpen || !shouldRender) return;
    const timeout = setTimeout(() => setShouldRender(false), exitDuration);
    return () => clearTimeout(timeout);
  }, [isOpen, shouldRender, exitDuration]);

  return { shouldRender, state };
}
