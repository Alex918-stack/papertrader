"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

const DROP_COUNT = 70;
// Raised from 0.16 now that the scene behind it is rain-on-glass rather
// than ocean - it's the actual weather in the footage now, not an
// ocean-adjacent flourish, so it earns a touch more presence. Still capped
// well short of anything that reads as "weather" over "atmosphere" - it
// must never compete with the headline/subtext for attention.
const MAX_OPACITY = 0.22;

function makeDrop(width: number, height: number): Drop {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    length: 14 + Math.random() * 18,
    speed: 5 + Math.random() * 4,
    opacity: 0.05 + Math.random() * MAX_OPACITY,
  };
}

// Canvas, not DOM nodes per drop - 70 animated elements as individual
// motion.div instances would mean 70 live layout/paint subscriptions for
// something purely decorative. One canvas, one rAF loop, draws to pixels
// directly. Confined to the hero's own bounds (absolute inset-0 on a
// relatively-positioned hero section, not fixed/viewport-wide), and its
// low, constant opacity is deliberately never bumped near body copy - it
// sits behind the hero text at the same faint level everywhere, rather
// than brightening under it, so it never becomes a legibility problem
// where it happens to cross a headline.
export default function Rain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    let frameId: number;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops = Array.from({ length: DROP_COUNT }, () => makeDrop(width, height));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.strokeStyle = "#e8f7f4";
      ctx!.lineWidth = 1;
      for (const drop of drops) {
        ctx!.globalAlpha = drop.opacity;
        ctx!.beginPath();
        ctx!.moveTo(drop.x, drop.y);
        ctx!.lineTo(drop.x - 2, drop.y + drop.length);
        ctx!.stroke();
        drop.y += drop.speed;
        drop.x -= 0.4;
        if (drop.y > height) {
          drop.y = -drop.length;
          drop.x = Math.random() * width;
        }
      }
      frameId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
  );
}
