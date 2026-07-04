"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminMessage, UserType, AdminRole } from "@/lib/types";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";
import Link from "next/link";

interface SenderInfo {
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  user_type: UserType;
  admin_role: AdminRole | null;
}

interface Props {
  currentUserId: string;
  initialMessages: AdminMessage[];
}

export function AdminGroupChat({ currentUserId, initialMessages }: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<AdminMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, SenderInfo>>(new Map());

  // Seed cache from initial messages
  useEffect(() => {
    initialMessages.forEach((m) => {
      if (m.sender) profileCache.current.set(m.sender_id, m.sender as SenderInfo);
    });
  }, [initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-group-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_messages" },
        async (payload) => {
          const row = payload.new as AdminMessage;
          // Don't duplicate if we already added this optimistically
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return prev; // Will be handled below
          });

          let sender = profileCache.current.get(row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, avatar_emoji, avatar_url, user_type, admin_role")
              .eq("id", row.sender_id)
              .single();
            const newSender: SenderInfo = data ?? { display_name: "Admin", avatar_emoji: null, avatar_url: null, user_type: "admin" as UserType, admin_role: null };
            profileCache.current.set(row.sender_id, newSender);
            sender = newSender;
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, sender }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const { data, error: insertError } = await supabase
      .from("admin_messages")
      .insert({ sender_id: currentUserId, content })
      .select()
      .single();
    if (insertError) {
      setText(content);
      showError("Could not send message. Please try again.");
    } else if (data) {
      const sender = profileCache.current.get(currentUserId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, { ...(data as AdminMessage), sender }];
      });
    }
    setSending(false);
  }

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface flex flex-col h-[500px]">
      {error && (
        <div className="mx-4 mt-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">
            {t("messages.noHouseMessages")}
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] ${isMine ? "order-2" : ""}`}>
                {!isMine && (
                  <Link
                    href={`/admin/profile/${m.sender_id}`}
                    className="text-xs text-command font-mono mb-0.5 block hover:underline truncate"
                  >
                    {m.sender?.display_name}
                    {m.sender?.admin_role && (
                      <span className="text-ink-faint"> · {m.sender.admin_role}</span>
                    )}
                  </Link>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 text-sm break-words ${
                    isMine ? "bg-command text-white rounded-br-sm" : "bg-ink-surface2 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                <p className={`text-[10px] text-ink-faint font-mono mt-0.5 ${isMine ? "text-right" : ""}`}>
                  {format(new Date(m.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-border p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={t("messages.placeholder")}
          aria-label={t("messages.placeholder")}
          className="flex-1 bg-ink-surface2 border border-ink-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-command transition-colors"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="rounded-xl bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm shrink-0"
        >
          {t("common.send")}
        </button>
      </div>
    </div>
  );
}
