"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HouseMessage } from "@/lib/types";
import { format } from "date-fns";
import { useI18n } from "@/components/I18nProvider";

interface Props {
  houseId: string;
  currentUserId: string;
  initialMessages: HouseMessage[];
}

export function HouseChatBox({ houseId, currentUserId, initialMessages }: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const [messages, setMessages] = useState<HouseMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    initialMessages.forEach((m) => {
      if (m.sender) profileCache.current.set(m.sender_id, m.sender);
    });
  }, [initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`house-chat-${houseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "house_messages", filter: `house_id=eq.${houseId}` },
        async (payload) => {
          const row = payload.new as HouseMessage;
          let sender = profileCache.current.get(row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, avatar_emoji, user_type, admin_role")
              .eq("id", row.sender_id)
              .single();
            sender = data;
            if (sender) profileCache.current.set(row.sender_id, sender);
          }
          setMessages((prev) => [...prev, { ...row, sender }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("house_messages")
      .insert({ house_id: houseId, sender_id: currentUserId, content });
    if (error) setText(content);
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[560px] rounded-xl2 border border-ink-border bg-ink-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8">{t("messages.noHouseMessages")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const isAdmin = m.sender?.user_type === "admin";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {!mine && (
                  <span className="text-xs text-ink-muted px-1">
                    {m.sender?.avatar_emoji} {m.sender?.display_name}
                    {isAdmin && <span className="text-command ml-1">· {m.sender?.admin_role}</span>}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    mine ? "bg-command text-white rounded-br-sm" : "bg-ink-surface2 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-ink-faint px-1 font-mono">{format(new Date(m.created_at), "HH:mm")}</span>
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
          placeholder={t("messages.housePlaceholder")}
          className="flex-1 rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="px-4 rounded-lg bg-command hover:bg-command/85 disabled:opacity-40 transition-colors font-semibold text-sm"
        >
          {t("common.send")}
        </button>
      </div>
    </div>
  );
}
