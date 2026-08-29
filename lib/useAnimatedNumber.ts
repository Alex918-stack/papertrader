"use client";

import { useEffect, useRef, useState } from "react";

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Tweens a numeric value smoothly whenever it changes, instead of snapping.
 * Mid-flight value changes continue from the current animated position
 * rather than restarting from the original number.
 */
export function useAnimatedNumber(value: number, duration = 400) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = currentRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const next = from + (to - from) * easeOutQuart(t);
      currentRef.current = next;
      setDisplayValue(next);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return displayValue;
}
