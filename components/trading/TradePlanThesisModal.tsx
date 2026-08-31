"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { TradeToExecute } from "@/lib/executeTradePlan";
import { TradeThesis } from "@/lib/PortfolioContext";
import ThesisForm, { ThesisFormValues, EMPTY_THESIS_VALUES } from "@/components/trading/ThesisForm";
import { shareWord } from "@/lib/format";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";

type StepDecision = { kind: "include"; thesis: TradeThesis | undefined } | { kind: "exclude" };

interface TradePlanThesisModalProps {
  isOpen: boolean;
  trades: TradeToExecute[];
  openingIndexes: number[];
  isGuest: boolean;
  onComplete: (finalTrades: TradeToExecute[]) => void;
  onCancel: () => void;
}

function summarizeOtherTrades(trades: TradeToExecute[]): string {
  const parts = trades.map((t) =>
    t.action === "BUY"
      ? `add ${t.shares} ${shareWord(t.shares)} to ${t.symbol}`
      : `sell ${t.shares} ${shareWord(t.shares)} of ${t.symbol}`
  );
  return `This plan also does the following automatically, once all theses are in: ${parts.join("; ")}.`;
}

function buildThesisFromDraft(draft: ThesisFormValues): TradeThesis | undefined {
  if (!draft.whyThis.trim() && !draft.whyNow.trim() && !draft.invalidation.trim()) {
    return undefined;
  }
  const invalidationPrice = draft.invalidationPrice.trim() ? Number(draft.invalidationPrice) : undefined;
  return {
    whyThis: draft.whyThis.trim(),
    whyNow: draft.whyNow.trim(),
    invalidation: draft.invalidation.trim(),
    invalidationPrice: Number.isFinite(invalidationPrice) ? invalidationPrice : undefined,
  };
}

// Shown instead of immediately executing whenever a proposed plan would
// open one or more new positions - collects every required thesis first
// (nothing executes until the final "This is my plan" click below), one trade at a
// time so "which trade, how many are left" is always answered on screen,
// rather than a wall of forms with no context. Forward-only by design: no
// back button to revise an earlier step - keeps this simple, matching
// "keep it short and unintimidating." Cancel is always available and safe,
// since nothing has executed yet no matter how far into the steps you are.
export default function TradePlanThesisModal({
  isOpen,
  trades,
  openingIndexes,
  isGuest,
  onComplete,
  onCancel,
}: TradePlanThesisModalProps) {
  const { shouldRender, state } = useDelayedUnmount(isOpen, 150);

  const [stepPos, setStepPos] = useState(0);
  const [draft, setDraft] = useState<ThesisFormValues>(EMPTY_THESIS_VALUES);
  const [decisions, setDecisions] = useState<Map<number, StepDecision>>(new Map());

  // This component now stays mounted across opens (so the exit animation
  // has something to fade out) instead of remounting fresh each time via
  // the parent's old `{open && <Modal />}` pattern - a fresh open has to
  // explicitly reset the wizard back to step 0 instead of resuming
  // whatever state a previous cancelled/completed run left behind.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setStepPos(0);
      setDraft(EMPTY_THESIS_VALUES);
      setDecisions(new Map());
    }
  }

  if (!shouldRender) return null;

  const done = stepPos >= openingIndexes.length;
  const tradeIndex = done ? null : openingIndexes[stepPos];
  const currentTrade = tradeIndex !== null ? trades[tradeIndex] : null;
  const otherTrades = trades.filter((_, i) => !openingIndexes.includes(i));

  function advance(decision: StepDecision) {
    if (tradeIndex === null) return;
    setDecisions((prev) => new Map(prev).set(tradeIndex, decision));
    setDraft(EMPTY_THESIS_VALUES);
    setStepPos((p) => p + 1);
  }

  function handleNext() {
    advance({ kind: "include", thesis: buildThesisFromDraft(draft) });
  }

  function handleDontMakeTrade() {
    advance({ kind: "exclude" });
  }

  const finalTrades: TradeToExecute[] = [];
  trades.forEach((t, i) => {
    const decision = decisions.get(i);
    if (decision?.kind === "exclude") return;
    finalTrades.push(decision?.kind === "include" ? { ...t, thesis: decision.thesis } : t);
  });

  return (
    <div
      className="overlay-enter fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      data-state={state}
      onClick={onCancel}
    >
      <div
        className="modal-enter bg-white border border-neutral-200 rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        {!done && currentTrade ? (
          <>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
                Thesis {stepPos + 1} of {openingIndexes.length}
              </p>
              <h2 className="text-lg font-semibold text-neutral-900">
                Opening {currentTrade.symbol}
              </h2>
              <p className="text-sm text-neutral-500">
                {currentTrade.action} {currentTrade.shares} {shareWord(currentTrade.shares)}
              </p>
            </div>

            {otherTrades.length > 0 && (
              <p className="text-xs text-neutral-500 bg-neutral-50 rounded-md p-2.5">
                {summarizeOtherTrades(otherTrades)}
              </p>
            )}

            {currentTrade.rationale && (
              <div className="rounded-md border border-coral-200 bg-coral-50 p-3">
                <p className="text-xs font-semibold text-coral-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Sparkles size={12} /> Krix&apos;s reasoning
                </p>
                <p className="text-sm text-neutral-700">{currentTrade.rationale}</p>
              </div>
            )}

            <ThesisForm
              value={draft}
              onChange={setDraft}
              isGuest={isGuest}
              symbol={currentTrade.symbol}
              contextHint={currentTrade.rationale}
            />

            <div className="flex gap-2">
              <button
                onClick={handleDontMakeTrade}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.97] text-neutral-700 font-medium py-2 rounded-md transition-all duration-150 ease-out-quart text-sm"
              >
                Don&apos;t make this trade
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-coral-500 hover:bg-coral-600 active:scale-[0.97] text-white font-medium py-2 rounded-md transition-all duration-150 ease-out-quart text-sm"
              >
                Next
              </button>
            </div>
            <button
              onClick={onCancel}
              className="w-full text-xs text-neutral-400 hover:text-neutral-600"
            >
              Cancel plan
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
                Ready to execute
              </p>
              <h2 className="text-lg font-semibold text-neutral-900">
                {finalTrades.length} trade{finalTrades.length === 1 ? "" : "s"}
              </h2>
            </div>

            {finalTrades.length > 0 ? (
              <ul className="divide-y divide-neutral-100 text-sm">
                {finalTrades.map((t, i) => (
                  <li key={i} className="py-2 flex justify-between">
                    <span
                      className={`font-medium ${t.action === "BUY" ? "text-green-700" : "text-red-600"}`}
                    >
                      {t.action}
                    </span>
                    <span className="text-neutral-700">
                      {t.shares} {t.symbol}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">
                Every trade in this plan was skipped - nothing to execute.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.97] text-neutral-700 font-medium py-2 rounded-md transition-all duration-150 ease-out-quart text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => onComplete(finalTrades)}
                disabled={finalTrades.length === 0}
                className="flex-1 bg-coral-500 hover:bg-coral-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-medium py-2 rounded-md transition-all duration-150 ease-out-quart text-sm"
              >
                This is my plan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
