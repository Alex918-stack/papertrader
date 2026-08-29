"use client";

import { Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Conversation } from "@/lib/chatHistory";

interface ChatHistoryPanelProps {
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleCollapse: () => void;
}

export default function ChatHistoryPanel({
  conversations,
  activeId,
  collapsed,
  onSelect,
  onNew,
  onDelete,
  onToggleCollapse,
}: ChatHistoryPanelProps) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  if (collapsed) {
    return (
      <div className="flex-shrink-0 bg-white border border-neutral-200 rounded-lg flex flex-col items-center py-3 gap-3 h-[65vh] w-14 shadow-sm">
        <button
          onClick={onToggleCollapse}
          className="text-neutral-400 hover:text-neutral-900 active:scale-[0.9] transition-transform duration-150 ease-out-quart p-2 rounded-md hover:bg-neutral-100"
          aria-label="Expand chat history"
          title="Expand chat history"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          onClick={onNew}
          className="text-coral-600 hover:text-coral-700 active:scale-[0.9] transition-all duration-150 ease-out-quart p-2 rounded-md hover:bg-coral-50"
          aria-label="New chat"
          title="New chat"
        >
          <Plus size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full sm:w-64 flex-shrink-0 bg-white border border-neutral-200 rounded-lg flex flex-col h-[65vh] shadow-sm">
      <div className="p-3 border-b border-neutral-200 flex items-center gap-2">
        <button
          onClick={onNew}
          className="flex-1 flex items-center gap-2 bg-coral-500 hover:bg-coral-600 active:scale-[0.97] text-white text-sm font-medium px-3 py-2 rounded-md transition-all duration-150 ease-out-quart"
        >
          <Plus size={16} />
          New chat
        </button>
        <button
          onClick={onToggleCollapse}
          className="text-neutral-400 hover:text-neutral-700 active:scale-[0.9] transition-transform duration-150 ease-out-quart p-2 rounded-md hover:bg-neutral-100 flex-shrink-0"
          aria-label="Collapse chat history"
          title="Collapse chat history"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 space-y-1" data-lenis-prevent>
        {sorted.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-6 px-2">
            No conversations yet. Start a new chat to see it here.
          </p>
        )}
        {sorted.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
              conv.id === activeId
                ? "bg-coral-50 text-coral-800"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare size={14} className="flex-shrink-0" />
            <span className="text-sm truncate flex-1">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 active:scale-[0.9] transition-all duration-150 ease-out-quart flex-shrink-0"
              aria-label="Delete conversation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}