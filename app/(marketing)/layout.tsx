"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const lenis = new Lenis({ smoothWheel: true });

    let frameId: number;
    function raf(time: number) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }
    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return <div className="min-h-screen bg-white">{children}</div>;
}
