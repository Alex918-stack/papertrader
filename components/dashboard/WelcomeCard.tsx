"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { STARTING_CASH } from "@/lib/constants";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

// Only render for a genuinely blank account (no holdings, no transactions
// ever) - gone for good the moment someone places their first trade, since
// PortfolioSnapshot and the rest of the dashboard take over from there.
// Same condition for guests and signed-in users; this is about account
// state, not auth state.
export default function WelcomeCard() {
  const { holdings, transactions, loading } = usePortfolio();

  if (loading || holdings.length > 0 || transactions.length > 0) return null;

  return (
    <Card padding="detail" className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-coral-50 text-coral-600 flex items-center justify-center flex-shrink-0">
        <Rocket size={20} />
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-neutral-900">
          You&apos;re starting with ${STARTING_CASH.toLocaleString("en-US")} in practice cash.
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          AI Paper Trader runs on real market prices - nothing here is real
          money. Place a trade to see how it plays out, or let Krix build you
          a plan.
        </p>
      </div>
      <Link
        href="/trading"
        className={buttonVariants({ className: "w-full sm:w-auto flex-shrink-0" })}
      >
        Place Your First Trade
      </Link>
    </Card>
  );
}
