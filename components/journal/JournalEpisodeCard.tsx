"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { JournalEpisode } from "@/components/journal/JournalProvider";
import { formatMoney } from "@/lib/format";
import ExitReflectionForm from "@/components/journal/ExitReflectionForm";
import Card from "@/components/ui/Card";

const EXIT_REFLECTION_LABELS: Record<string, string> = {
  thesis_played_out: "Thesis played out",
  invalidated_as_expected: "Invalidated as expected",
  exited_early_emotional: "Exited early (emotional)",
  exited_early_new_info: "Exited early (new info)",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface JournalEpisodeCardProps {
  episode: JournalEpisode;
  highlighted: boolean;
  onUpdate: (id: string, patch: Partial<JournalEpisode>) => void;
}

export default function JournalEpisodeCard({
  episode,
  highlighted,
  onUpdate,
}: JournalEpisodeCardProps) {
  const [generating, setGenerating] = useState(false);
  const isOpen = episode.closedAt === null;
  const hasThesis = episode.thesisWhyThis !== null;

  async function handleGenerateCritique() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/journal/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id }),
      });
      const data = await res.json();
      if (res.ok && data.critique) {
        onUpdate(episode.id, { critique: data.critique, critiqueGeneratedAt: new Date().toISOString() });
      }
    } catch {
      // Silent - the button just stays available to try again.
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card
      id={`episode-${episode.id}`}
      className={`space-y-3 transition-colors ${
        highlighted ? "border-coral-400 ring-2 ring-coral-200" : ""
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-neutral-900">{episode.symbol}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isOpen ? "bg-seafoam-50 text-seafoam-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          Opened {formatDate(episode.openedAt)}
          {episode.closedAt ? ` · Closed ${formatDate(episode.closedAt)}` : ""}
        </span>
      </div>

      {hasThesis ? (
        <div className="space-y-1.5 text-sm">
          <p>
            <span className="text-neutral-400">Why this: </span>
            {episode.thesisWhyThis}
          </p>
          <p>
            <span className="text-neutral-400">Why now: </span>
            {episode.thesisWhyNow}
          </p>
          <p>
            <span className="text-neutral-400">What would prove wrong: </span>
            {episode.thesisInvalidation}
          </p>
          {episode.thesisInvalidationPrice != null && (
            <p>
              <span className="text-neutral-400">Invalidation price: </span>$
              {formatMoney(episode.thesisInvalidationPrice)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 italic">No thesis written for this position.</p>
      )}

      {!isOpen && (
        <div className="border-t border-neutral-100 pt-3 space-y-2">
          {episode.exitReflection ? (
            <p className="text-sm">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sand-100 text-sand-700 mr-2">
                {EXIT_REFLECTION_LABELS[episode.exitReflection] ?? episode.exitReflection}
              </span>
              {episode.exitReflectionNote && (
                <span className="text-neutral-600">{episode.exitReflectionNote}</span>
              )}
            </p>
          ) : (
            <ExitReflectionForm
              episodeId={episode.id}
              onSubmitted={(reflection, note) =>
                onUpdate(episode.id, { exitReflection: reflection, exitReflectionNote: note })
              }
            />
          )}

          {episode.critique ? (
            <div className="rounded-md border border-coral-200 bg-coral-50 p-3">
              <p className="text-xs font-semibold text-coral-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Sparkles size={12} /> Krix&apos;s critique
              </p>
              <p className="text-sm text-neutral-700">{episode.critique}</p>
            </div>
          ) : (
            <button
              onClick={handleGenerateCritique}
              disabled={generating}
              className="text-xs text-neutral-400 hover:text-coral-600 disabled:opacity-60 underline underline-offset-2"
            >
              {generating ? "Asking Krix…" : "Generate Krix's critique"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
