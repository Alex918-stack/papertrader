"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";

const REFLECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "thesis_played_out", label: "Thesis played out" },
  { value: "invalidated_as_expected", label: "Invalidated as expected" },
  { value: "exited_early_emotional", label: "Exited early (emotional)" },
  { value: "exited_early_new_info", label: "Exited early (new info)" },
  { value: "other", label: "Other" },
];

interface ExitReflectionFormProps {
  episodeId: string;
  onSubmitted: (reflection: string, note: string | null) => void;
}

// Write-once, enforced by record_exit_reflection and backstopped by a DB
// trigger - the warning below has to land BEFORE the click, not after,
// since there's no "are you sure" moment once the request is sent and no
// way to walk it back afterward either way.
export default function ExitReflectionForm({ episodeId, onSubmitted }: ExitReflectionFormProps) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_exit_reflection", {
      p_episode_id: episodeId,
      p_exit_reflection: selected,
      p_exit_reflection_note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      showToast(error.message || "Couldn't save your reflection.", "error");
      return;
    }
    onSubmitted(selected, note.trim() || null);
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-sm font-medium text-neutral-700">How did this play out?</p>
      <p className="text-xs text-sand-700">
        This can only be recorded once — there&apos;s no editing it after you submit, so take a
        moment before you do.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {REFLECTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelected(opt.value)}
            className={`text-xs px-2.5 py-1.5 rounded-full border active:scale-[0.97] transition-all duration-150 ease-out-quart ${
              selected === opt.value
                ? "bg-coral-500 border-coral-500 text-white"
                : "bg-white border-neutral-200 text-neutral-600 hover:border-coral-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything else worth remembering? (optional)"
        className="w-full bg-white text-neutral-900 text-sm rounded-md px-3 py-2 border border-neutral-200 focus:outline-none focus:border-coral-400 resize-none"
      />

      <button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="w-full bg-coral-500 hover:bg-coral-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-all duration-150 ease-out-quart"
      >
        {submitting ? "Saving…" : "Save reflection (final)"}
      </button>
    </div>
  );
}
