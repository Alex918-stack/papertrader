import { Briefcase } from "lucide-react";
import PerformanceCard from "@/components/portfolio/PerformanceCard";
import BenchmarkComparison from "@/components/portfolio/BenchmarkComparison";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import PageHeroHeader from "@/components/layout/PageHeroHeader";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={Briefcase}
        title="Portfolio"
        subtitle="Holdings, performance, and your full trade history."
      />
      <PerformanceCard />
      <BenchmarkComparison />
      <HoldingsTable />
    </div>
  );
}