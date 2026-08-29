"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wallet, Banknote, Layers } from "lucide-react";
import { usePortfolioValue } from "@/hooks/usePortfolioValue";
import { recordPoint } from "@/lib/priceHistory";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import TiltCard from "@/components/ui/TiltCard";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/components/layout/AuthProvider";
import GuestNotice from "@/components/ui/GuestNotice";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PortfolioSnapshot() {
  const { cash, holdings, totalValue, portfolioLoading, quotesLoading } = usePortfolioValue();
  const { status } = useAuth();
  const animatedTotalValue = useAnimatedNumber(totalValue);
  const animatedCash = useAnimatedNumber(cash);

  useEffect(() => {
    if (!quotesLoading) {
      recordPoint("portfolio-total", totalValue);
    }
  }, [totalValue, quotesLoading]);

  return (
    <div id="tour-portfolio-snapshot" className="perspective-container">
      <TiltCard intensity={4}>
        <Link
          href="/portfolio"
          className="block bg-white border border-neutral-200 rounded-lg p-4 shadow-sm hover:border-coral-300 hover:shadow-md transition-all cursor-pointer"
        >
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">
            Portfolio Snapshot
          </h2>
          {portfolioLoading ? (
            <div className="flex justify-between text-sm">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-coral-50 text-coral-600 flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-neutral-400">Total Value</p>
                  <p className="num text-xl font-bold text-neutral-900">
                    {holdings.length > 0 && quotesLoading
                      ? "..."
                      : `$${formatMoney(animatedTotalValue)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-seafoam-50 text-seafoam-600 flex items-center justify-center flex-shrink-0">
                  <Banknote size={16} />
                </div>
                <div>
                  <p className="text-neutral-400">Cash</p>
                  <p className="num text-xl font-bold text-neutral-900">
                    ${formatMoney(animatedCash)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sand-200 text-sand-700 flex items-center justify-center flex-shrink-0">
                  <Layers size={16} />
                </div>
                <div>
                  <p className="text-neutral-400">Positions</p>
                  <p className="num text-xl font-bold text-neutral-900">
                    {holdings.length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Link>
      </TiltCard>
      {status !== "authenticated" && !portfolioLoading && (
        <div className="mt-3">
          <GuestNotice />
        </div>
      )}
    </div>
  );
}
