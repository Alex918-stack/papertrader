"use client";

import Link from "next/link";
import {
  Target,
  Scale,
  Gauge,
  Clock,
  Scissors,
  Ruler,
  TrendingUp,
  Compass,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { useDecisionScorecard } from "@/hooks/useDecisionScorecard";
import PageHeroHeader from "@/components/layout/PageHeroHeader";
import ScorecardHeadline from "@/components/journal/scorecard/ScorecardHeadline";
import MetricCard from "@/components/journal/scorecard/MetricCard";
import ConcentrationCard from "@/components/journal/scorecard/ConcentrationCard";
import GuestNotice from "@/components/ui/GuestNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import Card from "@/components/ui/Card";

function formatPct(value: number, digits = 1): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export default function ScorecardPage() {
  const result = useDecisionScorecard();

  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={BarChart3}
        title="Decision Quality Scorecard"
        subtitle="Not whether you made money - whether the reasoning behind it holds up."
      />

      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-coral-600 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Journal
      </Link>

      {result.status === "loading" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {result.status === "signed_out" && (
        <Card>
          <GuestNotice />
        </Card>
      )}

      {result.status === "unavailable" && (
        <Card>
          <p className="text-sm text-neutral-400">
            Couldn&apos;t load your scorecard right now. Check back later.
          </p>
        </Card>
      )}

      {result.status === "ok" && (
        <div className="space-y-6">
          <ScorecardHeadline headline={result.headline} />

          <div className="grid sm:grid-cols-2 gap-4">
            <MetricCard icon={Target} title="Win rate" gate={result.winRate} lockedNoun="closed positions">
              {(value) => (
                <div>
                  <p className="num text-3xl font-bold text-neutral-900">{(value.rate * 100).toFixed(0)}%</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {value.wins} wins, {value.losses} losses
                  </p>
                </div>
              )}
            </MetricCard>

            <MetricCard icon={Scale} title="Avg win vs. avg loss" gate={result.avgWinLoss} lockedNoun="closed positions">
              {(value) => (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-400">Avg win</p>
                    <p className={`num text-xl font-bold ${value.avgWinPct !== null ? "text-green-700" : "text-neutral-400"}`}>
                      {value.avgWinPct !== null ? formatPct(value.avgWinPct) : "No wins yet"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Avg loss</p>
                    <p className="num text-xl font-bold text-red-600">
                      {value.avgLossPct !== null ? formatPct(value.avgLossPct) : "No losses yet"}
                    </p>
                  </div>
                </div>
              )}
            </MetricCard>

            <MetricCard icon={Gauge} title="Profit factor" gate={result.profitFactor} lockedNoun="closed positions">
              {(value) => (
                <div>
                  <p className="num text-3xl font-bold text-neutral-900">
                    {value.value !== null ? value.value.toFixed(2) : "Undefined"}
                  </p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {value.value !== null
                      ? `$${formatMoney(value.grossProfit)} gross profit vs. $${formatMoney(value.grossLoss)} gross loss`
                      : "No losses recorded yet - can't compute a ratio."}
                  </p>
                </div>
              )}
            </MetricCard>

            <Card className="space-y-3">
              <div className="flex items-center gap-2 text-neutral-500">
                <Clock size={16} className="flex-shrink-0" />
                <h3 className="text-sm font-medium">Holding period: winners vs. losers</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-400">Winners</p>
                  {result.holdingPeriods.winners.status === "available" ? (
                    <p className="num text-xl font-bold text-neutral-900">
                      {result.holdingPeriods.winners.value.avgDays.toFixed(1)}d avg
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-400">
                      {result.holdingPeriods.winners.have} of {result.holdingPeriods.winners.need}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Losers</p>
                  {result.holdingPeriods.losers.status === "available" ? (
                    <p className="num text-xl font-bold text-neutral-900">
                      {result.holdingPeriods.losers.value.avgDays.toFixed(1)}d avg
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-400">
                      {result.holdingPeriods.losers.have} of {result.holdingPeriods.losers.need}
                    </p>
                  )}
                </div>
              </div>
              {(() => {
                const winnersLocked = result.holdingPeriods.winners.status !== "available";
                const losersLocked = result.holdingPeriods.losers.status !== "available";
                if (winnersLocked && losersLocked) {
                  return (
                    <p className="text-xs text-neutral-400">
                      Needs at least 5 closed winners and 5 closed losers, independently, before averaging either side.
                    </p>
                  );
                }
                if (winnersLocked) {
                  return <p className="text-xs text-neutral-400">Needs at least 5 closed winners before averaging that side.</p>;
                }
                if (losersLocked) {
                  return <p className="text-xs text-neutral-400">Needs at least 5 closed losers before averaging that side.</p>;
                }
                return null;
              })()}
            </Card>

            <Card className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-500">
                <Scissors size={16} className="flex-shrink-0" />
                <h3 className="text-sm font-medium">Over-trading cost</h3>
              </div>
              <div>
                <p className="num text-3xl font-bold text-neutral-900">
                  ${formatMoney(result.overTradingCost.dollars.excessCost)}
                </p>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Spent on add-ons and partial trims beyond your initial entry and final exit
                  {result.overTradingCost.percent.status === "available"
                    ? ` - ${
                        // A real dollar cost next to "0.00%" reads as a bug.
                        // Anything that rounds to zero but isn't zero gets the
                        // "<0.01%" treatment instead.
                        result.overTradingCost.percent.value > 0 &&
                        result.overTradingCost.percent.value < 0.005
                          ? "<0.01"
                          : result.overTradingCost.percent.value.toFixed(2)
                      }% of capital deployed.`
                    : "."}
                </p>
              </div>
            </Card>

            <MetricCard icon={Ruler} title="Position sizing consistency" gate={result.positionSizing} lockedNoun="opened positions">
              {(value) => (
                <div>
                  <p className="num text-3xl font-bold text-neutral-900">{value.avgPercentOfCash.toFixed(1)}%</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    of available cash on average, ranging {value.minPercentOfCash.toFixed(1)}%-
                    {value.maxPercentOfCash.toFixed(1)}% across {value.count} entries
                  </p>
                </div>
              )}
            </MetricCard>

            <ConcentrationCard />

            <MetricCard icon={TrendingUp} title="Beat the S&P 500" gate={result.vsSp500.aggregate} lockedNoun="closed positions">
              {(value) => (
                <div>
                  <p className="num text-3xl font-bold text-neutral-900">
                    {value.beatCount} of {value.total}
                  </p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    closed positions beat SPY over the same holding window
                  </p>
                </div>
              )}
            </MetricCard>

            <div className="sm:col-span-2">
              <MetricCard
                icon={Compass}
                title="Exit vs. Your Own Plan"
                gate={result.exitVsPlan.aggregate}
                lockedNoun="checked positions"
              >
                {(value) => (
                  <div className="space-y-1">
                    <p className="text-sm text-neutral-700">
                      <span className="num font-semibold text-neutral-900">{value.invalidationHonored}</span> of{" "}
                      {value.eligible} positions were closed at or after your stated invalidation was actually
                      crossed.
                    </p>
                    {value.exitedBeforeInvalidationAtALoss > 0 && (
                      <p className="text-sm text-red-600">
                        <span className="num font-semibold">{value.exitedBeforeInvalidationAtALoss}</span> were
                        exited at a loss before that level was ever hit.
                      </p>
                    )}
                    {value.disagreementsWithSelfReport > 0 && (
                      <p className="text-sm text-sand-700">
                        On <span className="num font-semibold">{value.disagreementsWithSelfReport}</span>, what you
                        tagged and what the price data shows don&apos;t match - worth a second look.
                      </p>
                    )}
                  </div>
                )}
              </MetricCard>
              {(() => {
                const noPriceData = result.exitVsPlan.perEpisode.filter(
                  (e) => e.outcome.status === "no_price_data"
                ).length;
                return noPriceData > 0 ? (
                  <p className="text-xs text-neutral-400 mt-2">
                    {noPriceData} position{noPriceData === 1 ? "" : "s"} couldn&apos;t be checked - no price data
                    available for that window.
                  </p>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
