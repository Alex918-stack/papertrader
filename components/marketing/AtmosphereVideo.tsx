"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

// Poster paints on every request, server-rendered, zero JS dependency -
// this is what the LCP measurement below is against, not the video file.
// The <video> itself only mounts client-side, after confirming the visitor
// both has motion enabled and isn't on a narrow/likely-cellular viewport,
// so preload="none" is never even relevant to first paint - the element
// doesn't exist yet when paint happens.
const POSTER_SRC = "/videos/city-hero-poster.webp";
const VIDEO_SRC = "/videos/city-hero.mp4";

// Below this width, footage stays off - a background loop isn't worth
// pushing over what's likely a cellular connection, and the poster alone
// already carries the rain-window mood at that size.
const MIN_VIDEO_WIDTH = 768;

// window.matchMedia is genuinely unavailable during SSR, so server and
// first-client-paint must render the same thing (no video) - a plain
// useEffect + setState for this needs a real subscription or it's fighting
// React, not synchronizing with it. useSyncExternalStore is the correct
// primitive for an external/environment read that can differ between
// server and client. subscribe is intentionally a no-op: this is a
// load-time decision, not a live layout toggle - someone resizing a
// desktop window narrower mid-session shouldn't abort a video that's
// already downloading.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return window.matchMedia(`(min-width: ${MIN_VIDEO_WIDTH}px)`).matches;
}
function getServerSnapshot() {
  return false;
}

export default function AtmosphereVideo() {
  const reducedMotion = useReducedMotion();
  const wideEnough = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const showVideo = !reducedMotion && wideEnough;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- must be the
          exact same raw URL the <video poster> below uses, byte-for-byte,
          so the browser dedupes the fetch instead of loading the same
          frame twice (measured: next/image's re-encoded variant plus this
          layer's own request cost ~270kb combined for one frame, almost
          double the video itself). next/image can't help here either way -
          LCP is the H1 text (measured 1.1s), not this image. */}
      <img src={POSTER_SRC} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {showVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          poster={POSTER_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
