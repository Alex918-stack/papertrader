"use client";

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

interface ThesisFormProps {
  value: ThesisFormValues;
  onChange: (value: ThesisFormValues) => void;
  isGuest: boolean;
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
export default function ThesisForm({ value, onChange, isGuest }: ThesisFormProps) {
  function set(field: keyof ThesisFormValues, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-700">
          Why this trade? <span className="font-normal text-neutral-400">(optional)</span>
        </p>
        <button
          type="button"
          onClick={() => onChange(EMPTY_THESIS_VALUES)}
          className="text-xs text-neutral-400 hover:text-neutral-600 underline underline-offset-2 flex-shrink-0"
        >
          Skip
        </button>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Why this?</label>
        <textarea
          rows={2}
          value={value.whyThis}
          onChange={(e) => set("whyThis", e.target.value)}
          placeholder="What's the case for this stock right now?"
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Why now?</label>
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
          What would prove you wrong?
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
          Invalidation price (optional)
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
