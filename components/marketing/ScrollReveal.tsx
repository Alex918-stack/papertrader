"use client";

import { createContext, useContext, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from "motion/react";

const ScrollProgressContext = createContext<MotionValue<number> | null>(null);

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
}

// One scroll measurement per section, shared by every ScrollRevealItem
// inside it via context - not one useScroll per child. The arrival itself
// stays continuously scroll-linked (content arrives at the pace you
// scroll, not on a fixed-duration timer triggered by crossing a line), but
// once a section reaches fully revealed it LATCHES there for the rest of
// the session: scrolling back up to re-read something shouldn't watch it
// dissolve. That's a one-way flip (revealed, a motion value not React
// state - stays off the render cycle), not a live toggle, so it never
// regresses on scroll-up the way a plain progress-driven transform would.
export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "start 52%"] });
  const revealed = useMotionValue(0);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest >= 0.98 && revealed.get() === 0) revealed.set(1);
  });
  const latchedProgress = useTransform([scrollYProgress, revealed], (values) => {
    const [progress, isRevealed] = values as [number, number];
    return isRevealed ? 1 : progress;
  });

  return (
    <div ref={ref} className={className}>
      <ScrollProgressContext.Provider value={latchedProgress}>{children}</ScrollProgressContext.Provider>
    </div>
  );
}

interface ScrollRevealItemProps {
  children: React.ReactNode;
  index?: number;
  direction?: "up" | "left" | "right";
  className?: string;
}

const DISTANCE_PX = 32;
// Each item's own reveal spans this fraction of the parent's progress...
const SPAN = 0.45;
// ...starting this much later per index, so siblings arrive in sequence
// off ONE shared scroll measurement instead of each running their own.
const STAGGER = 0.1;

// Every section on the page imports this - one vocabulary (fade + rise or
// fade + slide), varied only by direction and stagger index, never a
// different kind of effect per section. Must be used inside a ScrollReveal
// (reads its shared progress from context); reduced motion degrades to a
// plain, always-visible div with no hooks doing scroll work.
export function ScrollRevealItem({ children, index = 0, direction = "up", className }: ScrollRevealItemProps) {
  const reducedMotion = useReducedMotion();
  const contextProgress = useContext(ScrollProgressContext);
  // Hooks must run unconditionally regardless of whether a provider is
  // present or reduced motion is on - this fallback keeps useTransform's
  // input valid either way; the branches below decide what's rendered.
  const fallbackProgress = useMotionValue(1);
  const progress = contextProgress ?? fallbackProgress;

  const start = Math.min(index * STAGGER, 0.9);
  const end = Math.min(start + SPAN, 1);
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const offset = useTransform(progress, [start, end], [DISTANCE_PX, 0]);
  const negOffset = useTransform(offset, (v) => -v);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const x = direction === "left" ? negOffset : direction === "right" ? offset : 0;
  const y = direction === "up" ? offset : 0;

  return (
    <motion.div style={{ opacity, x, y }} className={className}>
      {children}
    </motion.div>
  );
}
