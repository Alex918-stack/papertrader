import MarketOverview from "@/components/dashboard/MarketOverview";
import TopMovers from "@/components/dashboard/TopMovers";
import WatchlistCard from "@/components/dashboard/WatchlistCard";
import PortfolioSnapshot from "@/components/dashboard/PortfolioSnapshot";
import PortfolioChart from "@/components/charts/PortfolioChart";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Dashboard</h1>
      <PortfolioSnapshot />
      <MarketOverview />
      <PortfolioChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMovers />
        <WatchlistCard />
      </div>
    </div>
  );
}