"use client";

import { ExecutionPricing } from "@/lib/executionPricing";
import Button from "@/components/ui/Button";
import PricingBreakdown from "@/components/trading/PricingBreakdown";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";

interface OrderConfirmModalProps {
  isOpen: boolean;
  action: "BUY" | "SELL";
  symbol: string;
  companyName: string;
  shares: number;
  pricing: ExecutionPricing | null;
  isCrypto?: boolean;
  /**
   * True when this is an opening buy with a thesis attached (drafted with
   * Krix or hand-written - either way, this is the moment the user is
   * actively confirming it). Swaps the confirm button's label to make
   * authorship explicit: this executes the actual trade, and nothing before
   * it does, whether the thesis fields were typed or drafted.
   */
  hasThesis?: boolean;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OrderConfirmModal({
  isOpen,
  action,
  symbol,
  companyName,
  shares,
  pricing,
  isCrypto = false,
  hasThesis = false,
  submitting = false,
  onConfirm,
  onCancel,
}: OrderConfirmModalProps) {
  const { shouldRender, state } = useDelayedUnmount(isOpen && pricing !== null, 150);
  if (!shouldRender) return null;

  // pricing can legitimately go null while the exit animation is still
  // playing (it's a live quote-derived value, not owned by this modal) -
  // fall back to 0 rather than crash; the fields are fading out by then
  // anyway, not something the user is still reading.
  const total = shares * (pricing?.fillPrice ?? 0);
  const isBuy = action === "BUY";

  return (
    <div
      className="overlay-enter fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      data-state={state}
      onClick={onCancel}
    >
      <div
        id="tour-confirm-modal"
        // A fixed-position, viewport-centered overlay - outside Lenis's
        // scroll tree entirely, so GuidedTour's scroll-into-view can't
        // reach it if its own content ever exceeds the viewport (a short
        // window, a future field added here). Genuinely independent
        // insurance, not tour-specific: any modal this shape needs its own
        // internal scroll for the same reason a page does.
        className="modal-enter bg-white border border-neutral-200 rounded-lg max-w-sm w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-6 space-y-5 shadow-xl"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
            Confirm Order
          </p>
          <h2 className="text-lg font-semibold text-neutral-900">
            {isBuy ? "Buy" : "Sell"} {symbol}
          </h2>
          <p className="text-sm text-neutral-500">{companyName}</p>
        </div>

        <PricingBreakdown
          action={action}
          shares={shares}
          isCrypto={isCrypto}
          quotedPrice={pricing?.quotedPrice ?? 0}
          fillPrice={pricing?.fillPrice ?? 0}
          spreadCost={pricing?.spreadCost ?? 0}
          slippageCost={pricing?.slippageCost ?? 0}
          total={total}
        />

        <div className="flex gap-2">
          <Button onClick={onCancel} disabled={submitting} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting}
            variant={isBuy ? "buy" : "sell"}
            className="flex-1"
          >
            {submitting ? "Confirming..." : isBuy && hasThesis ? "This is my plan" : `Confirm ${isBuy ? "Buy" : "Sell"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}