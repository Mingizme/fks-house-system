"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DirectMessage } from "@/lib/types";
import { format } from "date-fns";

interface Props {
  currentUserId: string;
  otherUser: { id: string; display_name: string; avatar_emoji: string | null };
  initialMessages: DirectMessage[];
  isAdminChat?: boolean;
  initiallyBlocked?: boolean;
}

export function DirectChatBox({ currentUserId, otherUser, initialMessages, isAdminChat = false, initiallyBlocked = false }: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${[currentUserId, otherUser.id].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DirectMessage;
          const belongs =
            (row.sender_id === currentUserId && row.recipient_id === otherUser.id) ||
            (row.sender_id === otherUser.id && row.recipient_id === currentUserId);
          if (belongs) setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = text.trim();
    if (!content || sending || blocked) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: currentUserId,
      recipient_id: otherUser.id,
      content,
      is_admin_chat: isAdminChat,
    });
    if (error) setText(content);
    setSending(false);
  }

  async function toggleBlock() {
    if (blocked) {
      await supabase.from("blocks").delete().eq("blocker_id", currentUserId).eq("blocked_id", otherUser.id);
      setBlocked(false);
    } else {
      await supabase.from("blocks").insert({ blocker_id: currentUserId, blocked_id: otherUser.id });
      setBlocked(true);
    }
  }

  return (
    <div className="flex flex-col h-[560px] rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
      <div className="p-4 border-b border-ink-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{otherUser.avatar_emoji ?? "🙂"}</span>
          <span className="font-semibold">{otherUser.display_name}</span>
        </div>
        <button
          onClick={toggleBlock}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            blocked
              ? "border-danger/40 text-danger bg-danger/10 hover:bg-danger/15"
              : "border-ink-border text-ink-muted hover:text-danger hover:border-danger/40"
          }`}
        >
          {blocked ? "Bỏ chặn" : "Chặn"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">Chưa có tin nhắn. Gửi lời chào đầu tiên nhé!</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] flex flex-col gap-1">
                <div
                  className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    mine ? "bg-command text-white rounded-br-sm ml-auto" : "bg-ink-surface2 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                <span className={`text-[10px] text-ink-faint px-1 font-mono ${mine ? "text-right" : ""}`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-ink-border flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={blocked}
          placeholder={blocked ? "Bạn đã chặn người này" : "Nhắn tin..."}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending || blocked}
          className="px-4 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
