"use client";

import { useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { Sparkles } from "lucide-react";
import ChatWindow from "@/components/ai/ChatWindow";
import ChatHistoryPanel from "@/components/ai/ChatHistoryPanel";
import GuestNotice from "@/components/ui/GuestNotice";
import { useConversations } from "@/lib/useConversations";

const GREETING =
  "Hi, I'm Krix — your trading assistant. Ask me to research a stock, or tell me what trade you want to make and I'll put together a plan you can execute.";
const TUTORIAL_PROMPT = "I'm new here — can you walk me through placing my first trade?";

export default function TradingAssistant() {
  const { status } = useAuth();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const {
    conversations,
    activeId,
    handleNew,
    handleSelect,
    handleDelete,
    handleMessagesChange,
  } = useConversations("trading");

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Sparkles size={16} className="text-coral-500" />
        <h2 className="text-lg font-semibold text-neutral-900">Krix</h2>
      </div>

      {status !== "authenticated" && <GuestNotice />}

      <div className="flex flex-col sm:flex-row gap-3">
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
          greeting={GREETING}
          emptyStateAction={{ label: "Start Tutorial", prompt: TUTORIAL_PROMPT, tutorialMode: true }}
        />
      </div>
    </div>
  );
}
