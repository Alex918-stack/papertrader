"use client";

import { useState } from "react";
import OrderTicket from "@/components/trading/OrderTicket";
import TradeHistory from "@/components/trading/TradeHistory";
import StockChart from "@/components/charts/StockChart";
import { ALL_STOCKS } from "@/lib/stockSymbols";

export default function TradingPage() {
  const [activeSymbol, setActiveSymbol] = useState(ALL_STOCKS[0].symbol);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Paper Trading</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <OrderTicket onSymbolChange={setActiveSymbol} />
        <TradeHistory />
      </div>
      <StockChart symbol={activeSymbol} />
    </div>
  );
}