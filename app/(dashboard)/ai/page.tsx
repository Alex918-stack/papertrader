"use client";

import { useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { Bot } from "lucide-react";
import ChatWindow from "@/components/ai/ChatWindow";
import ChatHistoryPanel from "@/components/ai/ChatHistoryPanel";
import PageHeroHeader from "@/components/layout/PageHeroHeader";
import GuestNotice from "@/components/ui/GuestNotice";
import { useConversations } from "@/lib/useConversations";

export default function AIPage() {
  const { status } = useAuth();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const {
    conversations,
    activeId,
    handleNew,
    handleSelect,
    handleDelete,
    handleMessagesChange,
  } = useConversations("ai");

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={Bot}
        title="Krix"
        subtitle="Ask about your portfolio, recent trades, or general market concepts. This is educational, not financial advice."
      />

      {status !== "authenticated" && <GuestNotice />}

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
          emptyStateAction={{
            label: "What can you help me with?",
            prompt: "I'm new here — what can you help me with?",
          }}
        />
      </div>
    </div>
  );
}
