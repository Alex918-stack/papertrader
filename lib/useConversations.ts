"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/supabase";
import {
  Conversation,
  StoredMessage,
  createConversation,
  titleFromFirstMessage,
} from "@/lib/chatHistory";

export type ChatSurface = "ai" | "trading";

// Shared by the /ai page and TradingAssistant - they were two copies of the
// same load/save/CRUD logic differing only in which chat surface they hit.
// Now they differ only in the `surface` they pass in.
export function useConversations(surface: ChatSurface) {
  const { status, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Which conversation ids are known to exist as real Postgres rows already
  // - lets handleMessagesChange skip re-creating a conversation it already
  // persisted. A ref, not state: read and written synchronously within a
  // single handler call, never needs to cause a re-render on its own. This
  // is a fast-path optimization, not the correctness mechanism - see the
  // 23505 handling in persist() below for what actually guarantees
  // correctness if this ever disagrees with reality.
  const persistedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (status === "loading") return;

    let ignore = false;

    async function load() {
      setLoading(true);

      if (status === "authenticated") {
        try {
          const supabase = createClient();
          const { data: convRows, error: convError } = await supabase
            .from("conversations")
            .select("id, title, updated_at")
            .eq("surface", surface)
            .order("updated_at", { ascending: false });

          if (convError) throw convError;

          const ids = (convRows ?? []).map((c) => c.id);
          let msgRows: {
            conversation_id: string;
            role: string;
            content: string;
            proposed_trades: unknown;
            execution_results: unknown;
          }[] = [];

          if (ids.length > 0) {
            const { data, error: msgError } = await supabase
              .from("messages")
              .select("conversation_id, role, content, proposed_trades, execution_results")
              .in("conversation_id", ids)
              .order("ordinal", { ascending: true });
            if (msgError) throw msgError;
            msgRows = data ?? [];
          }

          if (ignore) return;

          const loaded: Conversation[] = (convRows ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            updatedAt: new Date(c.updated_at).getTime(),
            messages: msgRows
              .filter((m) => m.conversation_id === c.id)
              .map(
                (m): StoredMessage => ({
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  proposedTrades:
                    (m.proposed_trades as StoredMessage["proposedTrades"]) ?? null,
                  executionResults:
                    (m.execution_results as StoredMessage["executionResults"]) ?? null,
                })
              ),
          }));

          persistedIds.current = new Set(loaded.map((c) => c.id));
          setConversations(loaded);
          // Already sorted by updated_at desc from the query above.
          setActiveId(loaded.length > 0 ? loaded[0].id : null);
        } catch {
          if (!ignore) {
            persistedIds.current = new Set();
            setConversations([]);
            setActiveId(null);
          }
        }
      } else {
        // Signed out: in-memory only, on purpose - Decision 1. Nothing is
        // read from or written to anywhere.
        persistedIds.current = new Set();
        setConversations([]);
        setActiveId(null);
      }

      if (!ignore) setLoading(false);
    }

    load();

    return () => {
      ignore = true;
    };
  }, [status, surface]);

  function handleNew() {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    // Deliberately not persisted here - stays local-only (in both signed-in
    // and signed-out cases) until it actually has a first message. An
    // empty, never-used "New chat" draft shouldn't leave a row behind.
  }

  function handleSelect(id: string) {
    setActiveId(id);
  }

  function handleDelete(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    persistedIds.current.delete(id);

    if (status === "authenticated") {
      const supabase = createClient();
      // Fire-and-forget: the UI already reflects the delete. messages
      // cascade automatically (conversation_id references conversations
      // on delete cascade), no separate cleanup needed.
      void supabase.from("conversations").delete().eq("id", id);
    }
  }

  function handleMessagesChange(messages: StoredMessage[]) {
    let id = activeId;
    const isNewConversation = !id || !persistedIds.current.has(id);

    if (!id) {
      id = crypto.randomUUID();
      setActiveId(id);
    }

    const conversationId = id;
    // handleMessagesChange is an event-handler callback (invoked from
    // ChatWindow's onMessagesChange after a message is sent), never during
    // render - the purity rule can't see that from inside the hook body.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const computedTitle = isNewConversation
      ? titleFromFirstMessage(messages[0]?.content ?? "")
      : null;

    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conversationId);
      if (!exists) {
        return [
          { id: conversationId, title: computedTitle || "New chat", messages, updatedAt: now },
          ...prev,
        ];
      }
      return prev.map((c) =>
        c.id === conversationId ? { ...c, messages, updatedAt: now } : c
      );
    });

    if (status !== "authenticated") return; // guest: in-memory only, done

    void persist(conversationId, isNewConversation, computedTitle, messages).catch(() => {
      // Swallowed here on purpose: the chat already rendered above and
      // isn't waiting on this. A failed background save just means this
      // turn isn't on the server yet - the next message in the same
      // conversation re-queries the real state and tries again from
      // there, so it isn't a stuck failure, just a delayed one.
    });
  }

  async function persist(
    conversationId: string,
    isNewConversation: boolean,
    title: string | null,
    allMessages: StoredMessage[]
  ) {
    const supabase = createClient();

    if (isNewConversation) {
      const { error } = await supabase.from("conversations").insert({
        id: conversationId,
        user_id: user!.id,
        surface,
        title: title || "New chat",
      });
      if (error && error.code !== "23505") {
        // Real failure, not just "another call already created this row"
        // (23505 = unique_violation - see the comment on persistedIds
        // above for when that can legitimately happen). Don't insert
        // messages against a conversation that may not exist.
        return;
      }
      persistedIds.current.add(conversationId);
    } else {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    // Ask Postgres for the real current max ordinal rather than trust
    // client-side counting. Two fire-and-forget calls for the same
    // conversation can otherwise land out of the order they were sent in,
    // and client-side counting has no way to notice - this does, because
    // it asks the same place the previous call actually wrote to.
    const { data: maxRow } = await supabase
      .from("messages")
      .select("ordinal")
      .eq("conversation_id", conversationId)
      .order("ordinal", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startOrdinal = (maxRow?.ordinal ?? -1) + 1;
    // Ordinals are contiguous from 0, so "next free ordinal" and "count of
    // messages already saved" are the same number - this slices off
    // exactly the messages Postgres doesn't have yet.
    const newMessages = allMessages.slice(startOrdinal);

    if (newMessages.length === 0) return;

    const rows = newMessages.map((m, i) => ({
      conversation_id: conversationId,
      role: m.role,
      content: m.content,
      ordinal: startOrdinal + i,
      // StoredMessage's fields are plain JSON-serializable interfaces, but
      // TS can't structurally verify that against Json's index signature -
      // these values really are JSON going into a jsonb column.
      proposed_trades: (m.proposedTrades ?? null) as Json | null,
      execution_results: (m.executionResults ?? null) as Json | null,
    }));

    await supabase.from("messages").insert(rows);
  }

  return {
    conversations,
    activeId,
    loading,
    handleNew,
    handleSelect,
    handleDelete,
    handleMessagesChange,
  };
}
