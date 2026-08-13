"use client";

interface OrderConfirmModalProps {
  isOpen: boolean;
  action: "BUY" | "SELL";
  symbol: string;
  companyName: string;
  shares: number;
  price: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OrderConfirmModal({
  isOpen,
  action,
  symbol,
  companyName,
  shares,
  price,
  onConfirm,
  onCancel,
}: OrderConfirmModalProps) {
  if (!isOpen) return null;

  const total = shares * price;
  const isBuy = action === "BUY";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-sm w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
            Confirm Order
          </p>
          <h2 className="text-lg font-semibold text-neutral-100">
            {isBuy ? "Buy" : "Sell"} {symbol}
          </h2>
          <p className="text-sm text-neutral-500">{companyName}</p>
        </div>

        <div className="bg-neutral-800 rounded-md p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Action</span>
            <span
              className={`font-medium ${
                isBuy ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isBuy ? "Buy" : "Sell"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Shares</span>
            <span className="text-neutral-100 font-medium">{shares}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Price per share</span>
            <span className="text-neutral-100 font-medium">
              ${price.toFixed(2)}
            </span>
          </div>
          <div className="border-t border-neutral-700 pt-2 flex justify-between">
            <span className="text-neutral-300 font-medium">
              Estimated total
            </span>
            <span className="text-neutral-100 font-bold">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium py-2 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 font-medium py-2 rounded-md transition-colors text-white ${
              isBuy
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            Confirm {isBuy ? "Buy" : "Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}