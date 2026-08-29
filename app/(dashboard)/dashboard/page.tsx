import { LayoutDashboard } from "lucide-react";
import MarketOverview from "@/components/dashboard/MarketOverview";
import TopMovers from "@/components/dashboard/TopMovers";
import WatchlistCard from "@/components/dashboard/WatchlistCard";
import PortfolioSnapshot from "@/components/dashboard/PortfolioSnapshot";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import PortfolioOverviewRow from "@/components/dashboard/PortfolioOverviewRow";
import NewsWidget from "@/components/dashboard/NewsWidget";
import PageHeroHeader from "@/components/layout/PageHeroHeader";

// Grouped, not stacked: three zones matching the subtitle below - your
// portfolio (snapshot, chart, benchmark), the market (quotes), then movers
// and news. Same visual weight throughout; order and grouping carry the
// hierarchy, not per-section styling.
export default function Home() {
  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Your portfolio, the market, and the latest news at a glance."
      />
      <WelcomeCard />
      <PortfolioSnapshot />
      <PortfolioOverviewRow />
      <MarketOverview />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMovers />
        <WatchlistCard />
      </div>
      <NewsWidget />
    </div>
  );
}