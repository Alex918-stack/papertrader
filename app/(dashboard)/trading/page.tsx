"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import OrderTicket from "@/components/trading/OrderTicket";
import TradeHistory from "@/components/trading/TradeHistory";
import TradingAssistant from "@/components/trading/TradingAssistant";
import StockChart from "@/components/charts/StockChart";
import PageHeroHeader from "@/components/layout/PageHeroHeader";
import { ALL_ASSETS } from "@/lib/stockSymbols";

export default function TradingPage() {
  const [activeSymbol, setActiveSymbol] = useState(ALL_ASSETS[0].symbol);

  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={TrendingUp}
        title="Paper Trading"
        subtitle="Research a stock, place an order, or let Krix build a plan."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <OrderTicket onSymbolChange={setActiveSymbol} />
        <TradeHistory />
      </div>
      <TradingAssistant />
      <StockChart symbol={activeSymbol} />
    </div>
  );
}