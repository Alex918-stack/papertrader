"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export interface ThesisFormValues {
  whyThis: string;
  whyNow: string;
  invalidation: string;
  invalidationPrice: string;
}

export const EMPTY_THESIS_VALUES: ThesisFormValues = {
  whyThis: "",
  whyNow: "",
  invalidation: "",
  invalidationPrice: "",
};

type DraftedField = keyof ThesisFormValues;

interface ThesisFormProps {
  value: ThesisFormValues;
  onChange: (value: ThesisFormValues) => void;
  isGuest: boolean;
  /** The symbol being opened - required so "Draft with Krix" knows what to draft for. */
  symbol: string;
  /**
   * Krix's own stated reasoning for this trade, when the thesis is being
   * collected for a plan Krix already proposed (TradePlanThesisModal) -
   * passed through so the draft can build on that reasoning instead of
   * starting cold. Undefined for a manually-initiated trade (OrderTicket).
   */
  contextHint?: string;
}

const FIELD_CLASS =
  "w-full bg-neutral-100 text-neutral-900 text-sm rounded-md px-3 py-2 border border-transparent focus:outline-none focus:border-coral-400 resize-none";

// Deliberately three short textareas, not a long form - a wall of inputs
// between someone and their trade is how you train people to type "idk".
// invalidationPrice is the one optional field, for when the invalidation
// naturally reduces to a number ("if it drops below $150").
//
// Optional, not required - but expanded by default with a visible Skip,
// not collapsed behind an "add a thesis?" link. Hiding it behind a link is
// what actually kills the response rate; a visible form with an easy way
// out is what gets it filled in.
//
// "Draft with Krix" fills every field with a generated first pass, clearly
// marked as a draft - the user still has to read it, edit it (or not), and
// separately confirm the trade. Nothing here auto-submits: this component
// only ever calls onChange, never anything that executes a trade. See the
// confirm-button copy in OrderConfirmModal/TradePlanThesisModal for the
// other half of "Krix may draft, but the user must author."
export default function ThesisForm({ value, onChange, isGuest, symbol, contextHint }: ThesisFormProps) {
  const { showToast } = useToast();
  const [drafted, setDrafted] = useState<Set<DraftedField>>(new Set());
  const [drafting, setDrafting] = useState(false);

  // Derived-during-render reset, same pattern as OrderTicket's resetKey:
  // whenever the parent hands back the shared EMPTY_THESIS_VALUES constant
  // (Skip, or a symbol/action change resetting the form), the drafted
  // markers are stale and should clear with it.
  const [trackedValue, setTrackedValue] = useState(value);
  if (value !== trackedValue) {
    setTrackedValue(value);
    if (value === EMPTY_THESIS_VALUES && drafted.size > 0) {
      setDrafted(new Set());
    }
  }

  function set(field: keyof ThesisFormValues, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
    // Once the user edits a field, it stops reading as a draft - a value
    // Krix suggested and the user then typed over is authored, not drafted,
    // regardless of what it ends up saying.
    if (drafted.has(field)) {
      setDrafted((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  }

  async function handleDraft() {
    if (drafting) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/trading/draft-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, contextHint }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(body?.error || "Couldn't draft a thesis right now - try again.", "error");
        return;
      }
      const data: { whyThis: string; whyNow: string; invalidation: string; invalidationPrice: number | null } =
        await res.json();
      onChange({
        whyThis: data.whyThis,
        whyNow: data.whyNow,
        invalidation: data.invalidation,
        invalidationPrice: data.invalidationPrice != null ? String(data.invalidationPrice) : "",
      });
      setDrafted(new Set<DraftedField>(["whyThis", "whyNow", "invalidation", "invalidationPrice"]));
    } catch {
      showToast("Couldn't reach Krix right now - try again.", "error");
    } finally {
      setDrafting(false);
    }
  }

  function draftBadge(field: DraftedField) {
    if (!drafted.has(field)) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-coral-600 bg-coral-50 px-1.5 py-0.5 rounded-full ml-2">
        <Sparkles size={10} /> Drafted by Krix — edit before confirming
      </span>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-neutral-700">
          Why this trade? <span className="font-normal text-neutral-400">(optional)</span>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleDraft}
            disabled={drafting}
            className="inline-flex items-center gap-1 text-xs font-medium text-coral-600 hover:text-coral-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
          >
            <Sparkles size={12} />
            {drafting ? "Drafting…" : "Draft with Krix"}
          </button>
          <button
            type="button"
            onClick={() => onChange(EMPTY_THESIS_VALUES)}
            className="text-xs text-neutral-400 hover:text-neutral-600 underline underline-offset-2"
          >
            Skip
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Why this?{draftBadge("whyThis")}
        </label>
        <textarea
          rows={2}
          value={value.whyThis}
          onChange={(e) => set("whyThis", e.target.value)}
          placeholder="What's the case for this stock right now?"
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Why now?{draftBadge("whyNow")}
        </label>
        <textarea
          rows={2}
          value={value.whyNow}
          onChange={(e) => set("whyNow", e.target.value)}
          placeholder="What makes today the moment, not last week or next?"
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          What would prove you wrong?{draftBadge("invalidation")}
        </label>
        <textarea
          rows={2}
          value={value.invalidation}
          onChange={(e) => set("invalidation", e.target.value)}
          placeholder="The condition that means this thesis failed"
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Invalidation price (optional){draftBadge("invalidationPrice")}
        </label>
        <input
          type="number"
          step="any"
          value={value.invalidationPrice}
          onChange={(e) => set("invalidationPrice", e.target.value)}
          placeholder="e.g. 150"
          className={FIELD_CLASS}
        />
      </div>

      {isGuest && (
        <p className="text-xs text-sand-700">
          Sign in to save this thesis with your trade.
        </p>
      )}
    </div>
  );
}
