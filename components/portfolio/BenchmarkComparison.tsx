"use client";

import { Clock } from "lucide-react";
import { useBenchmarkComparison, BenchmarkComparisonResult } from "@/hooks/useBenchmarkComparison";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import GuestNotice from "@/components/ui/GuestNotice";
import Card from "@/components/ui/Card";

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

// Always-visible on both the dashboard and the portfolio page (same
// component, not a second implementation) - "you vs. the S&P 500" is the
// reality check this whole feature exists for, so it stays on screen even
// when there's nothing good to say (see the unavailable/insufficient_history
// states below), rather than only showing up when the news is favorable.
export default function BenchmarkComparison() {
  const comparison = useBenchmarkComparison();

  if (comparison.status === "loading") {
    return (
      <Card id="tour-benchmark-card" className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
      </Card>
    );
  }

  if (comparison.status === "signed_out") {
    return (
      <Card id="tour-benchmark-card" className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">You vs. S&P 500</h2>
        <GuestNotice />
      </Card>
    );
  }

  if (comparison.status === "unavailable") {
    return (
      <Card id="tour-benchmark-card" className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">You vs. S&P 500</h2>
        <p className="text-sm text-neutral-400">
          Benchmark unavailable right now - market data didn&apos;t load. Check
          back later.
        </p>
      </Card>
    );
  }

  if (comparison.status === "insufficient_history") {
    return (
      <Card id="tour-benchmark-card" className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">You vs. S&P 500</h2>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Clock size={15} className="flex-shrink-0 text-neutral-400" />
          <p>
            This compares your returns against the S&amp;P 500. It fills in
            after your first full trading day.
          </p>
        </div>
      </Card>
    );
  }

  return <ReadyComparison comparison={comparison} />;
}

function ReadyComparison({
  comparison,
}: {
  comparison: Extract<BenchmarkComparisonResult, { status: "ok" }>;
}) {
  const animatedYour = useAnimatedNumber(comparison.yourReturnPct);
  const animatedBenchmark = useAnimatedNumber(comparison.benchmarkReturnPct);

  const startLabel = new Date(`${comparison.benchmarkStartDate}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">You vs. S&P 500</h2>
        <span className="text-xs text-neutral-400">Since {startLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-neutral-400">You</p>
          <p
            className={`num text-2xl font-bold ${
              animatedYour >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {formatPct(animatedYour)}
          </p>
        </div>
        <div>
          <p className="text-sm text-neutral-400">S&P 500</p>
          <p
            className={`num text-2xl font-bold ${
              animatedBenchmark >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {formatPct(animatedBenchmark)}
          </p>
        </div>
      </div>
    </Card>
  );
}
