"use client";

import { useState, useRef, useEffect } from "react";
import { usePortfolio } from "@/lib/PortfolioContext";
import MessageBubble from "@/components/ai/MessageBubble";
import { StoredMessage } from "@/lib/chatHistory";
import { executeTradePlan, TradeToExecute } from "@/lib/executeTradePlan";
import { useToast } from "@/components/ui/ToastProvider";
import { formatMoney } from "@/lib/format";

interface ChatWindowProps {
  messages: StoredMessage[];
  onMessagesChange: (messages: StoredMessage[]) => void;
  greeting?: string;
  emptyStateAction?: { label: string; prompt: string; tutorialMode?: boolean };
  /**
   * Defaults to "tour-chat-input" - the id lib/tour.ts's "krix" beat
   * anchors to on the /ai page. More than one ChatWindow can be mounted at
   * once (KrixLauncher alongside TradingAssistant on /trading, say) -
   * every instance other than the one the tour actually targets MUST pass
   * a distinct id here, or two elements would share the same id and
   * document.querySelector would resolve to whichever happens to be first
   * in the DOM, not necessarily the real one.
   */
  inputId?: string;
  /**
   * Defaults to false (the fixed 65vh height every existing usage - /ai,
   * TradingAssistant - relies on for a normal in-page layout). True makes
   * this fill its parent instead, for a container that already owns its own
   * height (KrixLauncher's fixed-size floating panel) - fighting the fixed
   * height with an outer wrapper's CSS would be fragile (specificity ties
   * between two independent utility classes on the same element).
   */
  fillHeight?: boolean;
}

const DEFAULT_GREETING =
  "Hi, I'm Krix! I can help you think through your portfolio, explain market concepts, or talk through your recent trades. What's on your mind?";

export default function ChatWindow({
  messages,
  onMessagesChange,
  greeting = DEFAULT_GREETING,
  emptyStateAction,
  inputId = "tour-chat-input",
  fillHeight = false,
}: ChatWindowProps) {
  const { cash, holdings, transactions, buy, sell } = usePortfolio();
  const { showToast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // isSlow is only ever set to true by the timeout below (a genuine async
  // callback - fine per the rule). Resetting it to false when a fresh
  // loading cycle starts happens during render, not in an effect - same
  // "compare against a tracked key" pattern OrderTicket uses for resetKey.
  // The label itself is derived, never stored - one less place to
  // synchronously setState from an effect body.
  const [isSlow, setIsSlow] = useState(false);
  const [wasLoading, setWasLoading] = useState(loading);
  if (loading !== wasLoading) {
    setWasLoading(loading);
    if (loading) setIsSlow(false);
  }
  const loadingLabel = isSlow
    ? "Still working — this can take up to a minute when the AI is busy..."
    : "Thinking...";
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // Free-tier Gemini can genuinely take 30-60s+ under load, especially when
  // several tool calls are needed - a static "Thinking..." reads as frozen.
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => setIsSlow(true), 6000);
    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages]);

  function buildPortfolioContext() {
    const holdingsSummary = holdings
      .map((h) => `${h.symbol}: ${h.shares} shares at avg cost $${formatMoney(h.avgCost)}`)
      .join("\n");

    const recentTrades = transactions
      .slice(0, 5)
      .map(
        (t) =>
          `${t.type} ${t.shares} ${t.symbol} @ $${formatMoney(t.price)} (total $${formatMoney(t.total)})`
      )
      .join("\n");

    return `Cash available: $${formatMoney(cash)}
Current holdings:
${holdingsSummary || "None"}

Recent trades:
${recentTrades || "None yet"}`;
  }

  async function handleSend(overrideText?: string, tutorialMode = false) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    const userMessage: StoredMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    // Belt-and-suspenders client timeout: the server has its own bounded
    // retry/timeout logic, but a network hiccup or an unusually deep
    // multi-round research chain should never leave the UI stuck loading
    // forever with no feedback.
    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: updatedMessages,
          portfolioContext: buildPortfolioContext(),
          cash,
          holdings,
          tutorialMode,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const finalMessages = [
        ...updatedMessages,
        {
          role: "assistant" as const,
          content: data.reply,
          proposedTrades: data.proposedTrades ?? null,
        },
      ];

      onMessagesChange(finalMessages);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError(
          "That's taking longer than expected and was cancelled. Try a narrower question, or try again."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to get a response"
        );
      }
    } finally {
      clearTimeout(clientTimeout);
      setLoading(false);
      sendingRef.current = false;
    }
  }

  async function handleExecuteTrades(messageIndex: number, trades: TradeToExecute[]) {
    const results = await executeTradePlan(trades, { buy, sell });

    const succeeded = results.filter((r) => r.success).length;
    const closedEpisodeIds = results
      .map((r) => r.closedEpisodeId)
      .filter((id): id is string => Boolean(id));

    if (closedEpisodeIds.length === 1) {
      showToast("Position closed — view it in your journal.", "success", `/journal?episode=${closedEpisodeIds[0]}`);
    } else if (closedEpisodeIds.length > 1) {
      showToast(`${closedEpisodeIds.length} positions closed — view your journal.`, "success", "/journal");
    } else {
      showToast(
        succeeded === results.length
          ? `Executed ${succeeded} trade${succeeded === 1 ? "" : "s"}.`
          : `Executed ${succeeded} of ${results.length} trades — check the plan for details.`,
        succeeded > 0 ? "success" : "error"
      );
    }

    const updatedMessages = messages.map((m, i) =>
      i === messageIndex ? { ...m, executionResults: results } : m
    );
    onMessagesChange(updatedMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={`flex-1 flex flex-col bg-white overflow-hidden ${
        fillHeight ? "h-full" : "h-[65vh] border border-neutral-200 rounded-lg shadow-sm"
      }`}
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-5"
        data-lenis-prevent
      >
        {messages.length === 0 && !loading && (
          <>
            <MessageBubble role="assistant" content={greeting} />
            {emptyStateAction && (
              <div className="flex justify-start">
                <button
                  onClick={() => handleSend(emptyStateAction.prompt, emptyStateAction.tutorialMode)}
                  className="text-sm font-medium text-coral-600 border border-coral-200 bg-coral-50 hover:bg-coral-100 active:scale-[0.97] transition-all duration-150 ease-out-quart px-4 py-2 rounded-md"
                >
                  {emptyStateAction.label}
                </button>
              </div>
            )}
          </>
        )}
        {messages.map((message, i) => (
          <MessageBubble
            key={i}
            role={message.role}
            content={message.content}
            proposedTrades={message.proposedTrades}
            executionResults={message.executionResults}
            onExecuteTrades={
              message.proposedTrades ? (trades) => handleExecuteTrades(i, trades) : undefined
            }
            holdings={holdings}
          />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 text-neutral-500 rounded-2xl rounded-bl-md px-5 py-3.5 text-sm">
              {loadingLabel}
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 text-center py-2">{error}</p>
        )}
      </div>

      <div className="border-t border-neutral-200 p-4 flex gap-3">
        <textarea
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio or the market..."
          rows={2}
          className="flex-1 bg-neutral-100 text-neutral-900 rounded-md px-4 py-3 text-sm border border-transparent resize-none focus:outline-none focus:bg-white focus:border-coral-400"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="bg-coral-500 hover:bg-coral-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-medium px-5 py-2 rounded-md transition-all duration-150 ease-out-quart self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}