import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import {
  TradeToExecute,
  TradeExecutionResult,
  getOpeningTradeIndexes,
} from "@/lib/executeTradePlan";
import { Holding } from "@/types/portfolio";
import { useAuth } from "@/components/layout/AuthProvider";
import TradePlanThesisModal from "@/components/trading/TradePlanThesisModal";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  proposedTrades?: { trades: TradeToExecute[]; summary: string } | null;
  executionResults?: TradeExecutionResult[] | null;
  onExecuteTrades?: (trades: TradeToExecute[]) => Promise<void>;
  holdings?: Holding[];
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 last:mb-0 space-y-1.5 list-disc pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 last:mb-0 space-y-1.5 list-decimal pl-5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-coral-800">{children}</strong>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold mt-3 mb-2 first:mt-0">{children}</h3>
  ),
};

// "Not enough cash/shares left" and "Failed" look identical to a red
// "this didn't work" unless they're visually distinguished - a shortfall
// is an expected consequence of prices and cash moving while a multi-open
// plan's theses were being written, not a bug or a real error, so it gets
// the same neutral/informational treatment as GuestNotice rather than red.
function resultBadgeLabel(result: TradeExecutionResult): string {
  if (result.success) return "Done";
  if (result.failureReason === "cash_shortfall") return "Not enough cash left";
  if (result.failureReason === "shares_shortfall") return "Not enough shares left";
  return "Failed";
}

function resultBadgeClass(result: TradeExecutionResult): string {
  if (result.success) return "text-green-700";
  if (result.failureReason === "cash_shortfall" || result.failureReason === "shares_shortfall") {
    return "text-sand-700";
  }
  return "text-red-600";
}

function TradePlanCard({
  proposedTrades,
  executionResults,
  onExecuteTrades,
  holdings,
}: {
  proposedTrades: { trades: TradeToExecute[]; summary: string };
  executionResults?: TradeExecutionResult[] | null;
  onExecuteTrades?: (trades: TradeToExecute[]) => Promise<void>;
  holdings: Holding[];
}) {
  const { status } = useAuth();
  const [executing, setExecuting] = useState(false);
  const [thesisModalOpen, setThesisModalOpen] = useState(false);
  const executed = Boolean(executionResults && executionResults.length > 0);

  async function runExecution(finalTrades: TradeToExecute[]) {
    if (!onExecuteTrades) return;
    setExecuting(true);
    try {
      await onExecuteTrades(finalTrades);
    } finally {
      setExecuting(false);
    }
  }

  function handleExecute() {
    if (!onExecuteTrades || executing || executed) return;
    // Opening a new position needs a thesis first - the modal collects
    // every one that's needed before anything executes, so the "Executing…"
    // state below only ever reflects real execution time, not however long
    // the user spends writing theses.
    const openingIndexes = getOpeningTradeIndexes(proposedTrades.trades, holdings);
    if (openingIndexes.length > 0) {
      setThesisModalOpen(true);
      return;
    }
    void runExecution(proposedTrades.trades);
  }

  return (
    <div className="mt-3 bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-neutral-200 bg-neutral-50">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          Trade Plan
        </p>
        {proposedTrades.summary && (
          <p className="text-sm text-neutral-700 mt-1">{proposedTrades.summary}</p>
        )}
      </div>

      <ul className="divide-y divide-neutral-100">
        {proposedTrades.trades.map((trade, i) => {
          const result = executionResults?.[i];
          const isBuy = trade.action === "BUY";
          return (
            <li key={`${trade.symbol}-${i}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isBuy ? (
                    <TrendingUp size={16} className="text-green-700 flex-shrink-0" />
                  ) : (
                    <TrendingDown size={16} className="text-red-600 flex-shrink-0" />
                  )}
                  <span className={`num text-sm font-semibold ${isBuy ? "text-green-700" : "text-red-600"}`}>
                    {trade.action}
                  </span>
                  <span className="num text-sm font-semibold text-neutral-900">
                    {trade.shares} {trade.symbol}
                  </span>
                </div>
                {result && (
                  <span className={`text-xs font-medium ${resultBadgeClass(result)}`}>
                    {resultBadgeLabel(result)}
                  </span>
                )}
              </div>
              {trade.rationale && (
                <p className="text-xs text-neutral-500 mt-1">{trade.rationale}</p>
              )}
              {result && (
                <p className={`text-xs mt-1 ${result.success ? "text-neutral-500" : resultBadgeClass(result)}`}>
                  {result.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t border-neutral-200">
        <button
          onClick={handleExecute}
          disabled={executing || executed || !onExecuteTrades}
          className="w-full flex items-center justify-center gap-2 bg-coral-500 hover:bg-coral-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-all duration-150 ease-out-quart"
        >
          {executing && <Loader2 size={14} className="animate-spin" />}
          {executed ? "Plan executed" : executing ? "Executing…" : "Execute Plan"}
        </button>
      </div>

      <TradePlanThesisModal
        isOpen={thesisModalOpen}
        trades={proposedTrades.trades}
        openingIndexes={getOpeningTradeIndexes(proposedTrades.trades, holdings)}
        isGuest={status !== "authenticated"}
        onComplete={(finalTrades) => {
          setThesisModalOpen(false);
          void runExecution(finalTrades);
        }}
        onCancel={() => setThesisModalOpen(false)}
      />
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  proposedTrades,
  executionResults,
  onExecuteTrades,
  holdings = [],
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex message-enter ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] px-5 py-3.5 text-sm sm:text-base ${
          isUser
            ? "bg-coral-500 text-white rounded-2xl rounded-br-md"
            : "bg-neutral-100 text-neutral-900 rounded-2xl rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className="font-serif text-base leading-relaxed">
            <ReactMarkdown components={markdownComponents}>
              {content}
            </ReactMarkdown>
            {proposedTrades && proposedTrades.trades.length > 0 && (
              <TradePlanCard
                proposedTrades={proposedTrades}
                executionResults={executionResults}
                onExecuteTrades={onExecuteTrades}
                holdings={holdings}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
