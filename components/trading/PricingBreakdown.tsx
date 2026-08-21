import { formatMoney } from "@/lib/format";

interface PricingBreakdownProps {
  action: "BUY" | "SELL";
  shares: number;
  isCrypto?: boolean;
  quotedPrice: number;
  fillPrice: number;
  spreadCost: number;
  slippageCost: number;
  total: number;
}

// Extracted from OrderConfirmModal.tsx - the exact markup shown before a
// real trade confirms, byte-for-byte. Pure presentational: no hooks, no
// state, numbers in as props. Null-handling (pricing can legitimately be
// null while OrderConfirmModal's exit animation plays) stays with that
// caller, not here - this component only ever sees resolved numbers.
// Reused by the marketing hero so that surface shows the real component,
// not a copy that can drift the moment this one changes - see git history
// for the "40+ stocks" claim this same class of bug produced once already.
export default function PricingBreakdown({
  action,
  shares,
  isCrypto = false,
  quotedPrice,
  fillPrice,
  spreadCost,
  slippageCost,
  total,
}: PricingBreakdownProps) {
  const isBuy = action === "BUY";

  return (
    <div id="tour-confirm-pricing" className="bg-neutral-50 rounded-md p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-neutral-500">Action</span>
        <span
          className={`font-medium ${
            isBuy ? "text-green-700" : "text-red-600"
          }`}
        >
          {isBuy ? "Buy" : "Sell"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-neutral-500">{isCrypto ? "Quantity" : "Shares"}</span>
        <span className="text-neutral-900 font-medium">{shares}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-neutral-500">Quoted price</span>
        <span className="text-neutral-900 font-medium">
          ${formatMoney(quotedPrice)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-neutral-500">Est. fill price</span>
        <span className="text-neutral-900 font-medium">
          ${formatMoney(fillPrice)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-neutral-500">Est. spread</span>
        <span className="text-neutral-700">
          ${formatMoney(spreadCost)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-neutral-500">Est. slippage</span>
        <span className="text-neutral-700">
          ${formatMoney(slippageCost)}
        </span>
      </div>
      <p className="text-xs text-neutral-400">
        Spread and slippage are modeled estimates, not a real quoted
        spread - this data tier has no live bid/ask.
      </p>
      <div className="border-t border-neutral-200 pt-2 flex justify-between">
        <span className="text-neutral-600 font-medium">
          Estimated total
        </span>
        <span className="text-neutral-900 font-bold">
          ${formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
