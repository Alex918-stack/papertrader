"use client";

import { useRouter, usePathname } from "next/navigation";
import { Sparkles, RotateCcw } from "lucide-react";
import { useTour } from "@/components/tour/TourProvider";
import { TOUR_BEATS, TOUR_ENABLED } from "@/lib/tour";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Two prompts, not autoplay - GuidedTour never starts or resumes driving
// on its own. Mounted globally (AppShell), because resuming has to work
// wherever the user happens to land, but the fresh-start variant only
// shows on Dashboard - that's beat 0's natural home, not an arbitrary page.
export default function TourPrompt() {
  const tour = useTour();
  const router = useRouter();
  const pathname = usePathname();

  if (!TOUR_ENABLED) return null; // parked - see lib/tour.ts

  if (tour.phase === "not_started" && pathname === "/dashboard") {
    return (
      <Card padding="detail" className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-seafoam-50 text-seafoam-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-neutral-900">New here? Take the 3-minute tour.</h2>
          <p className="text-sm text-neutral-600 mt-1">
            We&apos;ll walk you through the whole app - one real trade, and why the fill won&apos;t match the quote.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={tour.skip} variant="secondary">
            Not now
          </Button>
          <Button
            onClick={() => {
              tour.start();
              router.push(TOUR_BEATS[0].page);
            }}
            variant="primary"
          >
            Start tour
          </Button>
        </div>
      </Card>
    );
  }

  if (tour.needsResumeConfirmation && tour.resumeStepIndex !== null) {
    const beat = TOUR_BEATS[tour.resumeStepIndex];
    if (!beat) return null;
    return (
      <Card padding="detail" className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-seafoam-50 text-seafoam-700 flex items-center justify-center flex-shrink-0">
          <RotateCcw size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-neutral-900">Continue your tour?</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Step {tour.resumeStepIndex + 1} of {tour.totalBeats} - {beat.title}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={tour.skip} variant="secondary">
            Not now
          </Button>
          <Button
            onClick={() => {
              tour.resume();
              router.push(beat.page);
            }}
            variant="primary"
          >
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
