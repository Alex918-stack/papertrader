"use client";

import { useState, useRef, useEffect } from "react";
import { usePortfolio } from "@/lib/PortfolioContext";
import MessageBubble from "@/components/ai/MessageBubble";
import { StoredMessage } from "@/lib/chatHistory";

interface ChatWindowProps {
  messages: StoredMessage[];
  onMessagesChange: (messages: StoredMessage[]) => void;
}

const GREETING = "Hi! I can help you think through your portfolio, explain market concepts, or talk through your recent trades. What's on your mind?";

export default function ChatWindow({ messages, onMessagesChange }: ChatWindowProps) {
  const { cash, holdings, transactions } = usePortfolio();
  const [displayedContent, setDisplayedContent] = useState<string[]>(
    messages.map((m) => m.content)
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // When the active conversation changes, show its saved messages instantly (no re-typing animation)
  useEffect(() => {
    setDisplayedContent(messages.map((m) => m.content));
  }, [messages]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [displayedContent]);

  function buildPortfolioContext() {
    const holdingsSummary = holdings
      .map((h) => `${h.symbol}: ${h.shares} shares at avg cost $${h.avgCost.toFixed(2)}`)
      .join("\n");

    const recentTrades = transactions
      .slice(0, 5)
      .map(
        (t) =>
          `${t.type} ${t.shares} ${t.symbol} @ $${t.price.toFixed(2)} (total $${t.total.toFixed(2)})`
      )
      .join("\n");

    return `Cash available: $${cash.toFixed(2)}
Current holdings:
${holdingsSummary || "None"}

Recent trades:
${recentTrades || "None yet"}`;
  }

  function revealGradually(fullText: string, index: number) {
    const words = fullText.split(" ");
    let current = 0;

    const interval = setInterval(() => {
      current += 2;
      const partial = words.slice(0, current).join(" ");

      setDisplayedContent((prev) => {
        const updated = [...prev];
        updated[index] = partial;
        return updated;
      });

      if (current >= words.length) {
        clearInterval(interval);
      }
    }, 30);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: StoredMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setDisplayedContent((prev) => [...prev, trimmed]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          portfolioContext: buildPortfolioContext(),
        }),
      });

      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

      const data = await res.json();
      const newIndex = updatedMessages.length;
      const finalMessages = [
        ...updatedMessages,
        { role: "assistant" as const, content: data.reply },
      ];

      onMessagesChange(finalMessages);
      setDisplayedContent((prev) => [...prev, ""]);
      revealGradually(data.reply, newIndex);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get a response"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
<div className="flex-1 flex flex-col h-[65vh] bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-5">
        {messages.length === 0 && !loading && (
          <MessageBubble role="assistant" content={GREETING} />
        )}
        {messages.map((message, i) => (
          <MessageBubble
            key={i}
            role={message.role}
            content={displayedContent[i] ?? ""}
          />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 text-neutral-400 rounded-2xl rounded-bl-md px-5 py-3.5 text-sm">
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400 text-center py-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-800 p-4 flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio or the market..."
          rows={2}
          className="flex-1 bg-neutral-800 text-neutral-100 rounded-md px-4 py-3 text-sm border border-neutral-700 resize-none focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-md transition-colors self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}