"use client";

import { usePortfolio } from "@/lib/PortfolioContext";
import PortfolioChart from "@/components/charts/PortfolioChart";
import BenchmarkComparison from "@/components/portfolio/BenchmarkComparison";

// Same row, whether or not there's chart data yet. PortfolioChart renders
// nothing for a brand-new account (no transactions) - rather than leave a
// gap where it would go, this collapses to Benchmark alone at full width,
// so the dashboard doesn't change shape depending on account age. Once a
// trade exists, it becomes the side-by-side pair.
export default function PortfolioOverviewRow() {
  const { transactions } = usePortfolio();
  const hasChartData = transactions.length > 0;

  if (!hasChartData) {
    return <BenchmarkComparison />;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2">
        <PortfolioChart />
      </div>
      <BenchmarkComparison />
    </div>
  );
}
