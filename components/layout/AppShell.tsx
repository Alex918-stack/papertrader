"use client";

import { useState, useRef, useEffect } from "react";
import Lenis from "lenis";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import GuidedTour from "@/components/tour/GuidedTour";
import TourPrompt from "@/components/tour/TourPrompt";
import { TourProvider } from "@/components/tour/TourProvider";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  // Desktop collapse (persistent icon-rail sidebar) and the mobile overlay
  // drawer are different UI patterns with opposite correct defaults - kept
  // as separate state so toggling one can never leave the other in a state
  // that surprises the user after a viewport resize.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Shared with GuidedTour (prop, not context - it's the only consumer) so
  // it can scroll a beat's target into view and forward wheel input past
  // driver.js's overlay using the SAME Lenis instance, rather than fighting
  // it with a second, independent scroll mechanism - see GuidedTour.tsx.
  const lenisRef = useRef<Lenis | null>(null);

  function handleToggleSidebar() {
    if (window.matchMedia("(min-width: 640px)").matches) {
      setDesktopCollapsed((prev) => !prev);
    } else {
      setMobileOpen((prev) => !prev);
    }
  }

  useEffect(() => {
    if (!mainRef.current || !contentRef.current) return;

    const lenis = new Lenis({
      wrapper: mainRef.current,
      content: contentRef.current,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let frameId: number;
    function raf(time: number) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }
    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <TourProvider>
      <div className="flex flex-col h-screen">
        <GuidedTour lenisRef={lenisRef} mainRef={mainRef} />
        <Navbar onToggleSidebar={handleToggleSidebar} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            desktopCollapsed={desktopCollapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 app-surface"
          >
            <div ref={contentRef} className="space-y-4">
              <TourPrompt />
              {children}
            </div>
          </main>
        </div>
      </div>
    </TourProvider>
  );
}
