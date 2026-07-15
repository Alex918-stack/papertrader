import OrderTicket from "@/components/trading/OrderTicket";
import TradeHistory from "@/components/trading/TradeHistory";

export default function TradingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Paper Trading</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderTicket />
        <TradeHistory />
      </div>
    </div>
  );
}