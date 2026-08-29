import { Sparkles } from "lucide-react";

interface ScorecardHeadlineProps {
  headline: string;
}

// Deliberately a sentence, not a score - see lib/decisionScorecard.ts's
// buildHeadline for why. It's always traceable to one real component metric
// below, never a computed grade this card invents on its own.
export default function ScorecardHeadline({ headline }: ScorecardHeadlineProps) {
  return (
    <div id="tour-scorecard-headline" className="ocean-gradient-hero rounded-3xl px-5 py-6 sm:px-8 sm:py-7 flex items-start gap-4">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-coral-600 shadow-sm">
        <Sparkles size={20} />
      </div>
      <p className="text-lg sm:text-xl font-semibold text-neutral-900 leading-snug pt-1">{headline}</p>
    </div>
  );
}
