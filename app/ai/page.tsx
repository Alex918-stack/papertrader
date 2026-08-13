"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ChatWindow from "@/components/ai/ChatWindow";
import ChatHistoryPanel from "@/components/ai/ChatHistoryPanel";
import {
  Conversation,
  StoredMessage,
  createConversation,
  titleFromFirstMessage,
} from "@/lib/chatHistory";

export default function AIPage() {
  const { status } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    async function load() {
      let saved: Conversation[] = [];

      if (status === "authenticated") {
        try {
          const res = await fetch("/api/sync/chat");
          if (res.ok) {
            const { data } = await res.json();
            saved = data ?? [];
          }
        } catch {
          saved = [];
        }
      } else {
        saved = [];
        localStorage.removeItem("ai-paper-trader:conversations");
      }

      setConversations(saved);
      setActiveId(
        saved.length > 0
          ? [...saved].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
          : null
      );
      setHasLoaded(true);
    }

    load();
  }, [status]);

  useEffect(() => {
    if (!hasLoaded) return;
    if (status !== "authenticated") return;

    fetch("/api/sync/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversations),
    }).catch(() => {
      // Silent - not critical if a single save fails
    });
  }, [conversations, hasLoaded, status]);

  function handleNew() {
    const conv = createConversation();
    setConversations((prev) => [...prev, conv]);
    setActiveId(conv.id);
  }

  function handleSelect(id: string) {
    setActiveId(id);
  }

  function handleDelete(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  }

  function handleMessagesChange(messages: StoredMessage[]) {
    if (!activeId) {
      const conv = createConversation();
      const updated = {
        ...conv,
        messages,
        title: titleFromFirstMessage(messages[0]?.content ?? ""),
        updatedAt: Date.now(),
      };
      setConversations((prev) => [...prev, updated]);
      setActiveId(updated.id);
      return;
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages,
              title:
                c.title === "New chat" && messages[0]
                  ? titleFromFirstMessage(messages[0].content)
                  : c.title,
              updatedAt: Date.now(),
            }
          : c
      )
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">AI Assistant</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ask about your portfolio, recent trades, or general market
          concepts. This is educational, not financial advice.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <ChatHistoryPanel
          conversations={conversations}
          activeId={activeId}
          collapsed={panelCollapsed}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
          onToggleCollapse={() => setPanelCollapsed((prev) => !prev)}
        />
        <ChatWindow
          key={activeId ?? "new"}
          messages={activeConversation?.messages ?? []}
          onMessagesChange={handleMessagesChange}
        />
      </div>
    </div>
  );
}