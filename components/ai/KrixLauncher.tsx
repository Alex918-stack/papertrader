"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import ChatWindow from "@/components/ai/ChatWindow";
import { useConversations } from "@/lib/useConversations";
import { useTour } from "@/components/tour/TourProvider";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";

const LAUNCHER_INPUT_ID = "krix-launcher-chat-input";

// Notion-AI-style floating entry point to Krix, present on every dashboard
// page so a question never costs the user their place - expands in place,
// never navigates. Shares the "ai" surface's conversation history with the
// full /ai page (same useConversations hook, same data) rather than forking
// a second, disconnected thread - a message sent from here shows up there
// too, and vice versa.
//
// Hidden in two cases, both deliberate:
// - On /ai itself: that page already IS this experience at full size: a
//   second, smaller copy of the same conversation floating on top of it
//   would be redundant, not additive, and would also duplicate ChatWindow's
//   textarea id if left unguarded.
// - Whenever the guided tour is active: driver.js's overlay dims everything
//   outside the current beat's highlighted element, and this is a
//   fixed-position control that could in principle land visually on top of
//   one (e.g. a beat anchored near the bottom-right of the viewport). Rather
//   than computing per-beat geometry to prove it never overlaps, it simply
//   doesn't render at all while a tour is in progress - the tour already has
//   its own dedicated Krix beat (lib/tour.ts's "krix" beat, on /ai).
export default function KrixLauncher() {
  const pathname = usePathname();
  const tour = useTour();
  const [expanded, setExpanded] = useState(false);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const { shouldRender, state } = useDelayedUnmount(expanded, 150);

  const { conversations, activeId, handleNew, handleMessagesChange } = useConversations("ai");
  const activeConversation = conversations.find((c) => c.id === activeId);

  function close() {
    setExpanded(false);
    // Focus returns to the launcher, not lost to the document body - the
    // keyboard-accessibility requirement this component exists to satisfy.
    launcherButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (pathname === "/ai" || tour.active) return null;

  return (
    <>
      <button
        ref={launcherButtonRef}
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? "Close Krix" : "Ask Krix"}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-coral-500 hover:bg-coral-600 text-white shadow-lg hover:shadow-xl active:scale-[0.9] transition-all duration-150 ease-out-quart flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500 focus-visible:ring-offset-2"
      >
        {expanded ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {shouldRender && (
        <div
          data-state={state}
          className="panel-enter fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-9rem)] bg-white border border-neutral-200 rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 flex-shrink-0">
            <div className="flex items-center gap-2 text-neutral-900">
              <Sparkles size={16} className="text-coral-500" />
              <span className="text-sm font-semibold">Krix</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNew}
                className="text-xs text-neutral-400 hover:text-coral-600 active:scale-[0.9] transition-transform duration-150 ease-out-quart px-2 py-1"
              >
                New chat
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close Krix"
                className="text-neutral-400 hover:text-neutral-600 active:scale-[0.9] transition-transform duration-150 ease-out-quart p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatWindow
              key={activeId ?? "new"}
              messages={activeConversation?.messages ?? []}
              onMessagesChange={handleMessagesChange}
              inputId={LAUNCHER_INPUT_ID}
              fillHeight
            />
          </div>
        </div>
      )}
    </>
  );
}
