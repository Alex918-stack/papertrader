"use client";

import { Clock, type LucideIcon } from "lucide-react";
import type { MetricGate } from "@/lib/decisionScorecard";
import Card from "@/components/ui/Card";

interface MetricCardProps<T> {
  icon: LucideIcon;
  title: string;
  gate: MetricGate<T>;
  lockedNoun: string; // e.g. "closed positions" - fills "N of M {noun}"
  children: (value: T) => React.ReactNode;
}

// The shared shell every gated metric renders through: a title row, then
// either the real value (children) or an honest progress readout - never a
// spinner standing in for a number that just isn't trustworthy yet. Reuses
// BenchmarkComparison's own "not enough data yet" language (Clock icon,
// muted text) rather than inventing a second visual vocabulary for the same
// idea.
export default function MetricCard<T>({ icon: Icon, title, gate, lockedNoun, children }: MetricCardProps<T>) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon size={16} className="flex-shrink-0" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {gate.status === "available" ? (
        children(gate.value)
      ) : (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Clock size={15} className="flex-shrink-0" />
          <p>
            {gate.have} of {gate.need} {lockedNoun} - not enough data yet.
          </p>
        </div>
      )}
    </Card>
  );
}
