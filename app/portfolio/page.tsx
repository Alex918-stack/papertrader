import PerformanceCard from "@/components/portfolio/PerformanceCard";
import HoldingsTable from "@/components/portfolio/HoldingsTable";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Portfolio</h1>
      <PerformanceCard />
      <HoldingsTable />
    </div>
  );
}